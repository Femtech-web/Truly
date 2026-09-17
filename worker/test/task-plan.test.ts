import { describe, expect, it } from 'vitest'
import { parseTaskPlan } from '../src/learning/task-plan'

describe('direct Task plans', () => {
  it('normalizes a short learner plan and creates stable step identifiers', () => {
    expect(parseTaskPlan({
      title: 'Learn Zama privacy',
      outcome: 'Explain the core privacy model and try one safe example.',
      steps: [
        { title: 'Understand the model', summary: 'Learn what stays private and what becomes public.' },
        { title: 'Try a small example', summary: 'Open the documentation and follow one focused example.' },
      ],
    })).toMatchObject({
      title: 'Learn Zama privacy',
      steps: [{ id: '1-understand-the-model' }, { id: '2-try-a-small-example' }],
    })
  })

  it('rejects plans that are too vague or too large', () => {
    expect(() => parseTaskPlan({ title: 'Task', outcome: 'Outcome', steps: [{ title: 'Only', summary: 'One' }] })).toThrow()
    expect(() => parseTaskPlan({ title: 'Task', outcome: 'Outcome', steps: Array.from({ length: 6 }, (_, index) => ({ title: `Step ${index}`, summary: 'Do it' })) })).toThrow()
  })

  it('preserves reviewed Path step identifiers', () => {
    expect(parseTaskPlan({ title: 'Path Task', outcome: 'Finish it.', steps: [
      { id: 'provider', title: 'Connect the app', summary: 'Prepare the connection.' },
      { id: 'account', title: 'Ask clearly', summary: 'Wait for a clear action.' },
    ]}).steps.map((step) => step.id)).toEqual(['provider', 'account'])
  })
})
