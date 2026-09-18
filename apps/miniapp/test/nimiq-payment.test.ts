import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import { sendNimiqPayment, unwrapNimiqTransaction } from '../src/wallet/nimiq-payment.ts'

test('preserves the Nimiq Pay failure reason after transaction approval', async () => {
  assert.throws(
    () => unwrapNimiqTransaction({
      error: {
        type: 'TRANSACTION_FAILED',
        message: 'No consensus established',
      },
    }),
    error => error instanceof Error && error.message === 'No consensus established',
  )
})

test('accepts the serialized transaction returned by Nimiq Pay', () => {
  assert.throws(
    () => unwrapNimiqTransaction(''),
    /invalid transaction response/i,
  )
  assert.equal(unwrapNimiqTransaction('AB'.repeat(80)), 'AB'.repeat(80))
})

test('binds the order id and current block height to the native payment request', async () => {
  const calls: Array<string | Record<string, unknown>> = []
  const provider = {
    getBlockNumber: async () => {
      calls.push('height')
      return 4_321
    },
    sendBasicTransactionWithData: async (input: Record<string, unknown>) => {
      calls.push(input)
      return 'ab'.repeat(80)
    },
  } as unknown as Pick<NimiqProvider, 'getBlockNumber' | 'sendBasicTransactionWithData'>

  const result = await sendNimiqPayment(provider, {
    recipient: 'NQ12 37R4 KTF9 AC69 S6SM VMA5 K0TA KYPC PB5G',
    value: 1_000,
    reference: 'order-123',
  })

  assert.equal(result, 'ab'.repeat(80))
  assert.deepEqual(calls, [
    'height',
    {
      recipient: 'NQ12 37R4 KTF9 AC69 S6SM VMA5 K0TA KYPC PB5G',
      value: 1_000,
      data: 'order-123',
      validityStartHeight: 4_321,
    },
  ])
})

test('stops before approval when Nimiq Pay cannot provide a valid block height', async () => {
  let requestedApproval = false
  const provider = {
    getBlockNumber: async () => 0,
    sendBasicTransactionWithData: async () => {
      requestedApproval = true
      return 'ab'.repeat(80)
    },
  } as unknown as Pick<NimiqProvider, 'getBlockNumber' | 'sendBasicTransactionWithData'>

  await assert.rejects(
    sendNimiqPayment(provider, {
      recipient: 'NQ12 37R4 KTF9 AC69 S6SM VMA5 K0TA KYPC PB5G',
      value: 1_000,
      reference: 'order-123',
    }),
    /current Mainnet block/i,
  )
  assert.equal(requestedApproval, false)
})
