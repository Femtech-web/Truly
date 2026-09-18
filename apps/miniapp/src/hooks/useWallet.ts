import { useCallback, useEffect, useRef, useState } from 'react'
import { getWalletError, wasRejected } from '../wallet/errors'
import { createNimiqWallet } from '../wallet/nimiqWallet'
import type { WalletPort, WalletState } from '../wallet/types'
import { endBrowserSession, resumeBrowserSession } from '../core/browser-session'
import { availableAccounts, changeAccount } from '../wallet/accounts'

const initialState: WalletState = {
  status: 'initializing',
  kind: null,
  account: null,
  consensus: null,
  message: null,
}

export function useWallet() {
  const [state, setState] = useState(initialState)
  const walletRef = useRef<WalletPort | null>(null)
  const approvalOpen = useRef(false)
  const operationRef = useRef(0)
  const discovered = useRef<string[]>([])

  useEffect(() => {
    let isCurrent = true
    const operation = ++operationRef.current
    Promise.all([createNimiqWallet(), resumeBrowserSession().catch(() => null)])
      .then(async ([wallet, session]) => {
        const consensus = await wallet.isConsensusEstablished()
        // SDK init can share a provider across StrictMode effects. Never disconnect
        // a stale initializer, or let it overwrite a newer explicit connection.
        if (!isCurrent || operation !== operationRef.current) return
        walletRef.current = wallet
        setState({ status: session ? 'connected' : 'ready', kind: wallet.kind,
          account: session?.account ?? null, consensus,
          message: consensus ? null : 'Nimiq is still syncing. You can browse while it gets ready.' })
      })
      .catch(() => {
        if (!isCurrent || operation !== operationRef.current) return
        setState({
          status: 'unavailable',
          kind: null,
          account: null,
          consensus: null,
          message: 'Open Truly inside Nimiq Pay to connect your wallet.',
        })
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const connect = useCallback(async (): Promise<string[]> => {
    if (approvalOpen.current) throw new Error('Finish the open wallet approval before switching accounts.')
    approvalOpen.current = true
    operationRef.current += 1

    try {
      let wallet = walletRef.current
      if (!wallet) {
        wallet = await createNimiqWallet()
        walletRef.current = wallet
      }
      const accounts = availableAccounts(await wallet.listAccounts())
      if (!accounts.length) throw new Error('No accounts were shared. Create or import your wallet inside Nimiq Pay, then refresh accounts here.')
      discovered.current = accounts
      return accounts
    } catch (error) {
      throw new Error(wasRejected(error) ? 'Connection cancelled. Your wallet was not changed.' : getWalletError(error))
    } finally {
      approvalOpen.current = false
    }
  }, [])

  const selectAccount = useCallback(async (selected: string) => {
    if (approvalOpen.current) throw new Error('Finish the open wallet approval before switching accounts.')
    approvalOpen.current = true
    try {
      await changeAccount({ selected, available: discovered.current, current: state.account, endSession: endBrowserSession,
        commit: account => {
          operationRef.current += 1
          setState(current => ({ ...current, kind: 'nimiq', status: 'connected', account, message: null }))
        } })
    } finally { approvalOpen.current = false }
  }, [state.account])

  const disconnect = useCallback(async (): Promise<boolean> => {
    if (approvalOpen.current) return false
    approvalOpen.current = true
    try { await endBrowserSession() }
    catch {
      setState(current => ({ ...current, message: 'Could not disconnect securely. Check your connection and try again.' }))
      approvalOpen.current = false
      return false
    }
    walletRef.current?.disconnect()
    operationRef.current += 1
    walletRef.current = null
    discovered.current = []
    approvalOpen.current = false
    setState({
      status: 'ready',
      kind: 'nimiq',
      account: null,
      consensus: null,
      message: 'Disconnected from Truly. Your wallet and paired Macs were not changed.',
    })
    return true
  }, [])

  const signMessage = useCallback(async (message: string) => {
    const wallet = walletRef.current
    if (!wallet || state.status !== 'connected' || !state.account) {
      throw new Error('Connect your Nimiq wallet before approving this action.')
    }

    if (approvalOpen.current) throw new Error('A wallet approval is already open. Finish it before trying again.')
    approvalOpen.current = true
    try { return await wallet.sign(message) }
    finally { approvalOpen.current = false }
  }, [state.account, state.status])

  return {
    ...state,
    connect,
    selectAccount,
    disconnect,
    signMessage,
    payNim: async (input: { recipient: string; value: number; reference: string }) => {
      const wallet = walletRef.current
      if (!wallet || state.status !== 'connected' || !state.account) throw new Error('Connect Nimiq Pay before paying.')
      if (approvalOpen.current) throw new Error('Finish the open wallet approval first.')
      approvalOpen.current = true
      try { return await wallet.payNim(input) }
      finally { approvalOpen.current = false }
    },
  }
}
