import { describe, expect, it } from 'vitest'
import { createTaskPlan, parseTaskPlan } from '../src/learning/task-plan'

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
    expect(() => parseTaskPlan({ title: 'Task', outcome: 'Outcome', steps: [] })).toThrow()
    expect(() => parseTaskPlan({ title: 'Task', outcome: 'Outcome', steps: Array.from({ length: 9 }, (_, index) => ({ title: `Step ${index}`, summary: 'Do it' })) })).toThrow()
  })
  it('accepts an honest single-step goal or a longer focused plan without three-step padding', () => {
    const step = { title: 'Compare', summary: 'Write a contrast.', challenge: 'Show your contrast.', rubric: ['A clear contrast is visible.'] }
    for (const count of [1, 2, 4, 8]) expect(parseTaskPlan({ title: 'Privacy', outcome: 'Explain it.', steps: Array.from({ length: count }, (_, index) => ({ ...step, title: `Compare ${index}` })) }).steps).toHaveLength(count)
  })
  it('sends intent-preserving instructions and only honest resource hints, not fetched page contents', async () => {
    let payload: { messages: Array<{ content: string }> } = { messages: [] }
    const plan = await createTaskPlan({ apiKey: 'test-only', model: 'test-only' }, 'Understand Zama', async (_url, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected JSON request')
      payload = JSON.parse(init.body)
      return Response.json({ choices: [{ message: { content: JSON.stringify({ title: 'Understand Zama on Mac', outcome: 'Explain privacy in your own words.', steps: [
        { title: 'Explain the idea', summary: 'Read your official resource and write a short explanation.', challenge: 'Show your own explanation.', rubric: ['Your explanation contrasts encrypted and unencrypted data.'] },
      ] }) } }] })
    }, [{ title: 'Official docs', url: 'https://docs.zama.org/example?private=never-forward' }])
    expect(plan.title).toBe('Understand Zama')
    expect(plan.steps).toHaveLength(1)
    expect(payload.messages[0]?.content).toContain('Do NOT convert understanding into installation')
    expect(payload.messages[0]?.content).toContain('pages have NOT been read')
    expect(payload.messages[1]?.content).toContain('docs.zama.org')
    expect(payload.messages[1]?.content).not.toContain('private=never-forward')
  })

  it('preserves reviewed Path step identifiers', () => {
    expect(parseTaskPlan({ title: 'Path Task', outcome: 'Finish it.', steps: [
      { id: 'provider', title: 'Connect the app', summary: 'Prepare the connection.' },
      { id: 'account', title: 'Ask clearly', summary: 'Wait for a clear action.' },
    ]}).steps.map((step) => step.id)).toEqual(['provider', 'account'])
  })
  it('preserves checkable criteria but rejects mismatched or duplicate steps', () => {
    const plan = { title: 'Privacy', outcome: 'Explain it', steps: [
      { id: 'one', title: 'Compare', summary: 'Write a comparison.', challenge: 'Show your own comparison.', rubric: ['The contrast is explicit.'] },
      { id: 'two', title: 'Try', summary: 'Show a safe example.', challenge: 'Show an example.', rubric: ['An example is visible.'] },
    ] }
    expect(parseTaskPlan(plan).steps[0]?.rubric).toEqual(['The contrast is explicit.'])
    expect(() => parseTaskPlan({ ...plan, steps: [plan.steps[0], plan.steps[0]] })).toThrow()
    expect(() => parseTaskPlan({ ...plan, steps: [{ ...plan.steps[0], challenge: null }, plan.steps[1]] })).toThrow()
  })
})
