import assert from 'node:assert/strict'
import test from 'node:test'
import { moveItem } from '../src/core/reorder.ts'
import { canDeleteCreatorDraft } from '../src/core/creator-draft-policy.ts'
import { creatorSubmissionIssues } from '../src/core/creator-submission.ts'

const submissionDocument = () => ({
  title: '', summary: '', description: '', category: '', language: 'English', outcomes: [] as string[], supportedEnvironments: [] as string[],
  steps: [{ title: '', summary: '', challenge: '' as string | null, rubric: [] as string[] }],
})

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

test('submission preflight names missing required creator fields', () => {
  const document = submissionDocument()
  document.title = 'Price NIM without rounding errors'
  document.summary = 'Convert exact NIM amounts.'
  document.category = 'NIM payments'
  document.outcomes = ['Convert NIM to Luna']
  document.steps[0]!.title = 'Represent the amount'
  document.steps[0]!.summary = 'Store the amount as integer Luna.'
  document.steps[0]!.rubric = ['Output shows both values']

  assert.deepEqual(creatorSubmissionIssues(document), [
    'description',
    'at least one tool or environment',
    'step 1 practice challenge',
  ])
})

test('submission preflight accepts a complete creator document', () => {
  const document = submissionDocument()
  Object.assign(document, {
    title: 'Price NIM without rounding errors', summary: 'Convert exact NIM amounts.', description: 'Build a precise price review.',
    category: 'NIM payments', outcomes: ['Convert NIM to Luna'], supportedEnvironments: ['Browser'],
  })
  Object.assign(document.steps[0]!, {
    title: 'Represent the amount', summary: 'Store the amount as integer Luna.', challenge: 'Build and run the price review.',
    rubric: ['Output shows both values'],
  })
  assert.deepEqual(creatorSubmissionIssues(document), [])
})
