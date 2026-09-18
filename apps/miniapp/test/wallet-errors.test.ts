import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPaymentError, getWalletError, wasRejected } from '../src/wallet/errors.ts'

test('preserves native wallet errors returned outside the documented SDK shape', () => {
  assert.equal(getWalletError({ message: 'Transaction could not be broadcast' }), 'Transaction could not be broadcast')
  assert.equal(getWalletError({ error: 'No consensus established' }), 'No consensus established')
  assert.equal(getWalletError({ error: { reason: 'Invalid validity start height' } }), 'Invalid validity start height')
  assert.equal(getWalletError('Network request failed'), 'Network request failed')
})

test('does not expose arbitrary native response fields', () => {
  assert.equal(
    getWalletError({ privateKey: 'must-not-appear', code: 'INTERNAL_ERROR' }),
    'Nimiq Pay could not complete the request (INTERNAL_ERROR). No payment was sent.',
  )
})

test('recognizes rejection messages from nested and plain native errors', () => {
  assert.equal(wasRejected({ error: { message: 'User rejected the request' } }), true)
  assert.equal(wasRejected({ reason: 'Request cancelled' }), true)
})

test('turns the native account-sync failure into a safe available-balance check', () => {
  assert.equal(
    getPaymentError(
      { message: 'Failed to send payment transaction: Something went wrong syncing your account' },
      'NQ47 GFC8 SCHC 7R99 01CJ Y797 1EMH 2253 2AG1',
    ),
    'Nimiq Pay could not prepare NQ47…2AG1 for this payment. In Nimiq Pay, make sure this account has enough available—not pending or staked—NIM, then reopen Truly. No payment was sent.',
  )
})
