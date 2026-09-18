import test from 'node:test'
import assert from 'node:assert/strict'
import { formatNimBalance } from '../src/core/nimiq-balance.ts'

test('formats exact Luna amounts as NIM without floating-point rounding', () => {
  assert.equal(formatNimBalance('11000000000', 'en-US'), '110,000 NIM')
  assert.equal(formatNimBalance('1', 'en-US'), '0.00001 NIM')
  assert.equal(formatNimBalance('0', 'en-US'), '0 NIM')
})
