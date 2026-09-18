import assert from 'node:assert/strict'
import test from 'node:test'
import { pathAccessPresentation } from '../src/core/path-access-presentation.ts'

test('an owned paid Path is presented as unlocked instead of locked with its price', () => {
  assert.deepEqual(pathAccessPresentation({ price: 0.01, owned: true }), {
    kind: 'owned',
    label: 'Unlocked',
  })
})

test('unowned paid and free Paths keep their normal catalog labels', () => {
  assert.deepEqual(pathAccessPresentation({ price: 0.01, owned: false }), {
    kind: 'paid',
    label: '0.01 NIM',
  })
  assert.deepEqual(pathAccessPresentation({ price: 0, owned: false }), {
    kind: 'free',
    label: 'Free',
  })
})
