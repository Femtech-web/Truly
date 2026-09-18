import type { ErrorResponse, NimiqProvider } from '@nimiq/mini-app-sdk'

type PaymentProvider = Pick<NimiqProvider, 'getBlockNumber' | 'sendBasicTransactionWithData'>
type PaymentInput = { recipient: string; value: number; reference: string }

export function unwrapNimiqTransaction(result: string | ErrorResponse) {
  if (typeof result === 'object' && result && 'error' in result) {
    throw new Error(result.error.message || 'Nimiq Pay could not complete the transaction.')
  }
  if (typeof result !== 'string' || !result.length) {
    throw new Error('Nimiq Pay returned an invalid transaction response. Do not pay again; refresh and check your wallet history.')
  }
  return result
}

export async function sendNimiqPayment(provider: PaymentProvider, input: PaymentInput) {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(input.reference)) {
    throw new Error('This payment reference is invalid. Review the purchase again before paying.')
  }
  // A Nimiq transaction is only valid for a bounded block window. Supplying
  // the current height avoids relying on a host-side fallback after approval.
  // We deliberately do not gate this on isConsensusEstablished(): some Nimiq
  // Pay builds report false while their block-height and payment APIs work.
  const validityStartHeight = await provider.getBlockNumber()
  if (!Number.isSafeInteger(validityStartHeight) || validityStartHeight < 1) {
    throw new Error('Nimiq Pay could not read the current testnet block. Close and reopen Truly, then try again.')
  }
  const result = await provider.sendBasicTransactionWithData({
    recipient: input.recipient,
    value: input.value,
    data: input.reference,
    validityStartHeight,
  })
  return unwrapNimiqTransaction(result)
}
