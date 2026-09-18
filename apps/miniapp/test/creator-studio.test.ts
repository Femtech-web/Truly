import assert from 'node:assert/strict'
import test from 'node:test'
import { moveItem } from '../src/core/reorder.ts'
import { canDeleteCreatorDraft } from '../src/core/creator-draft-policy.ts'

test('only private editable creator drafts offer deletion', () => {
  assert.equal(canDeleteCreatorDraft('draft'), true)
  assert.equal(canDeleteCreatorDraft('rejected'), true)
  assert.equal(canDeleteCreatorDraft('review'), false)
  assert.equal(canDeleteCreatorDraft('published'), false)
})

test('reordering preserves content and stable step identity without mutating the saved version', () => {
  const steps = [{ id: 'a', rubric: ['First'] }, { id: 'b', rubric: ['Second'] }, { id: 'c', rubric: ['Third'] }]
  const next = moveItem(steps, 2, 0)
  assert.deepEqual(next.map(s => s.id), ['c', 'a', 'b'])
  assert.deepEqual(steps.map(s => s.id), ['a', 'b', 'c'])
  assert.equal(next[0], steps[2])
  assert.equal(moveItem(steps, 0, -1), steps)
  assert.equal(moveItem(steps, 2, 3), steps)
})
