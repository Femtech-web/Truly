import test from 'node:test'
import assert from 'node:assert/strict'
import { walletPortfolioBoundary } from '../src/core/wallet-presentation.ts'

test('does not present a basic-address RPC balance as the complete Nimiq Pay wallet', () => {
  assert.equal(walletPortfolioBoundary.title, 'Balance & wallet history')
  assert.match(walletPortfolioBoundary.body, /complete balance and full transaction history stay in Nimiq Pay/i)
  assert.doesNotMatch(walletPortfolioBoundary.body, /public address balance|available to spend/i)
})
