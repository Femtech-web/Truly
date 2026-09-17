import assert from 'node:assert/strict'
import test from 'node:test'
import { createIdempotencyKey } from '../src/core/idempotency.ts'

test('creates a valid key when the Nimiq Pay WebView has no randomUUID', () => {
  const source = {
    getRandomValues(bytes: Uint8Array) {
      bytes.set([0, 17, 34, 51, 68, 85, 102, 119, 136, 153, 170, 187, 204, 221, 238, 255])
      return bytes
    },
  }

  const key = createIdempotencyKey(source)

  assert.equal(key, '00112233-4455-4677-8899-aabbccddeeff')
  assert.match(key, /^[A-Za-z0-9_-]{16,100}$/)
})

test('uses native randomUUID when the host provides it', () => {
  assert.equal(createIdempotencyKey({ randomUUID: () => 'native-key' }), 'native-key')
})
