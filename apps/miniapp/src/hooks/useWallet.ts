import { useCallback, useEffect, useRef, useState } from 'react'
import { getWalletError, wasRejected } from '../wallet/errors'
import { createNimiqWallet } from '../wallet/nimiqWallet'
import type { WalletPort, WalletState } from '../wallet/types'

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

  const prepare = useCallback(async (wallet: WalletPort) => {
    walletRef.current = wallet
    const consensus = await wallet.isConsensusEstablished()
    setState({
      status: 'ready',
      kind: wallet.kind,
      account: null,
      consensus,
      message: consensus ? null : 'Nimiq is still syncing. You can browse while it gets ready.',
    })
  }, [])

  useEffect(() => {
    let isCurrent = true

    createNimiqWallet()
      .then(async (wallet) => {
        if (!isCurrent) return
        await prepare(wallet)
      })
      .catch(() => {
        if (!isCurrent) return
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
  }, [prepare])

  const connect = useCallback(async () => {
    if (approvalOpen.current) return
    approvalOpen.current = true

    setState((current) => ({ ...current, status: 'connecting', message: null }))

    try {
      let wallet = walletRef.current
      if (!wallet) {
        wallet = await createNimiqWallet()
        walletRef.current = wallet
      }
      const accounts = await wallet.listAccounts()
      const account = accounts[0]

      if (!account) {
        throw new Error('No wallet was selected.')
      }

      setState((current) => ({ ...current, status: 'connected', account, message: null }))
    } catch (error) {
      setState((current) => ({
        ...current,
        status: wasRejected(error) ? 'rejected' : 'failed',
        account: null,
        message: wasRejected(error)
          ? 'Connection cancelled. Your wallet was not changed.'
          : getWalletError(error),
      }))
    } finally {
      approvalOpen.current = false
    }
  }, [])

  const disconnect = useCallback(() => {
    walletRef.current?.disconnect()
    walletRef.current = null
    approvalOpen.current = false
    setState({
      status: 'ready',
      kind: 'nimiq',
      account: null,
      consensus: null,
      message: 'Disconnected from Truly. Your wallet and paired Macs were not changed.',
    })
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
    disconnect,
    signMessage,
  }
}
