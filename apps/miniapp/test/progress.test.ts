import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupProgress } from '../src/core/progress.ts'
import type { ActiveLearningSession } from '../src/types.ts'

function session(id: string, taskId: string | null, updatedAt: string, status: ActiveLearningSession['status'] = 'active'): ActiveLearningSession {
  return { id, status, updatedAt, startedAt: updatedAt, device: { id: 'mac', name: 'Mac' },
    source: { kind: 'task', id: taskId ?? id, taskId, title: 'Task', summary: '', creatorName: null, version: null,
      outcomes: [], prerequisites: [], supportedEnvironments: ['Mac'], estimatedMinutes: null, stepCount: 2, workspaceLink: null, resources: [] },
    currentStep: { id: 'one', title: 'One', summary: '', index: 1, total: 2, workspaceLink: null, resources: [], challenge: null, rubric: [] },
    progress: { completedStepIds: [], completedCount: 0, total: 2, assessment: 'ai_checked' } }
}

function pathSession(id: string, taskId: string | null, updatedAt: string): ActiveLearningSession {
  const result = session(id, taskId, updatedAt, 'paused')
  result.source = {
    ...result.source,
    kind: 'path',
    id: 'skill_nimiq_first_mini_app',
    taskId,
    title: 'Build your first Nimiq Mini App',
    version: 1,
  }
  return result
}
test('groups historical Mac sessions by Task and preserves separate legacy sessions', () => {
  const input = [session('old', 'task', '2026-01-01'), session('new', 'task', '2026-01-02'), session('other', 'other-task', '2026-01-01'), session('legacy', null, '2026-01-01')]
  assert.deepEqual(groupProgress(input).map(item => item.id), ['new', 'other', 'legacy'])
  assert.equal(input[0].id, 'old')
})
test('prefers the current result over a paused session at the same handoff time', () => {
  assert.equal(groupProgress([session('old', 'task', '2026-01-01', 'paused'), session('current', 'task', '2026-01-01')])[0].id, 'current')
})

test('merges the legacy Path session into its newer Task-backed Path session', () => {
  const legacy = pathSession('legacy-path-session', null, '2026-01-01')
  const taskBacked = pathSession('task-path-session', 'task-for-path', '2026-01-02')

  assert.deepEqual(groupProgress([legacy, taskBacked]).map(item => item.id), ['task-path-session'])
})
