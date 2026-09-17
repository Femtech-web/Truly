import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { approvePairing, findPairing, hasCoreConfiguration, type PairingPreview } from '../core/client'
import { getWalletError, wasRejected } from '../wallet/errors'

type PairingStatus = 'entering' | 'looking-up' | 'confirming' | 'signing' | 'paired' | 'failed'

interface UsePairingInput {
  account: string | null
  walletKind: 'nimiq' | null
  signMessage(message: string): Promise<{ publicKey: string; signature: string }>
}

export function usePairing({ account, walletKind, signMessage }: UsePairingInput) {
  const [code, setCodeValue] = useState('')
  const [status, setStatus] = useState<PairingStatus>('entering')
  const [preview, setPreview] = useState<PairingPreview | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const accountRef = useRef(account)
  const operationRef = useRef(0)
  accountRef.current = account
  useEffect(() => {
    operationRef.current += 1
    setCodeValue(''); setStatus('entering'); setPreview(null); setMessage(null)
  }, [account])

  const setCode = useCallback((value: string) => {
    operationRef.current += 1
    const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setCodeValue(normalized)
    setPreview(null)
    setMessage(null)
    setStatus('entering')
  }, [])

  const lookup = useCallback(async () => {
    if (code.length !== 6) {
      setStatus('failed')
      setMessage('Enter all six characters shown on your Mac.')
      return
    }

    const operation = ++operationRef.current
    setStatus('looking-up')
    setMessage(null)
    try {
      const nextPreview = await findPairing(code)
      if (operationRef.current !== operation) return
      setPreview(nextPreview)
      setStatus('confirming')
    } catch (error) {
      if (operationRef.current !== operation) return
      setStatus('failed')
      setMessage(error instanceof Error ? error.message : 'Truly could not check that code. Please try again.')
    }
  }, [code])

  const approve = useCallback(async () => {
    if (!preview || !account) {
      setStatus('failed')
      setMessage('Connect your Nimiq wallet before approving this Mac.')
      return
    }
    if (walletKind !== 'nimiq') {
      setStatus('failed')
      setMessage('Open Truly inside Nimiq Pay to approve this Mac.')
      return
    }

    const operation = ++operationRef.current
    const approvingAccount = account
    const approvingPreview = preview
    setStatus('signing')
    setMessage(null)
    try {
      const signature = await signMessage(approvingPreview.message)
      if (operationRef.current !== operation || accountRef.current !== approvingAccount) return
      await approvePairing({
        challengeId: approvingPreview.challengeId,
        address: approvingAccount,
        publicKey: signature.publicKey,
        signature: signature.signature,
      })
      if (operationRef.current !== operation || accountRef.current !== approvingAccount) return
      setStatus('paired')
      setMessage(`${approvingPreview.deviceName} is ready to use with Truly.`)
    } catch (error) {
      if (operationRef.current !== operation || accountRef.current !== approvingAccount) return
      setStatus('failed')
      setMessage(wasRejected(error)
        ? 'Pairing cancelled. Nothing changed, and you can try again.'
        : getWalletError(error))
    }
  }, [account, preview, signMessage, walletKind])

  const reset = useCallback(() => {
    operationRef.current += 1
    setCodeValue('')
    setPreview(null)
    setMessage(null)
    setStatus('entering')
  }, [])

  return useMemo(() => ({
    code,
    status,
    preview,
    message,
    isCoreConfigured: hasCoreConfiguration(),
    setCode,
    lookup,
    approve,
    reset,
  }), [approve, code, lookup, message, preview, reset, setCode, status])
}
