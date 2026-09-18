import test from 'node:test'
import assert from 'node:assert/strict'
import { handoffActionCopy } from '../src/core/handoff-presentation.ts'

test('shows a delivered confirmation after a Task reaches the selected Mac', () => {
  assert.equal(handoffActionCopy({ busy: false, deliveredDeviceName: null }), 'Continue on my Mac')
  assert.equal(handoffActionCopy({ busy: true, deliveredDeviceName: null }), 'Getting the Mac ready…')
  assert.equal(handoffActionCopy({ busy: false, deliveredDeviceName: 'MacBook Pro' }), 'Loaded in Truly on MacBook Pro')
})
