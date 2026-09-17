import { describe, expect, it } from 'vitest'
import { askGroq, getGroqConfiguration, systemPrompt } from '../src/learning/groq'
import type { LearningContext } from '../src/learning/access'
import { AI_CONSENT_REVISION, parseLearningOutput, parseLearningTurn } from '../src/learning/protocol'
import type { Env } from '../src/types'

const validTurn = {
  learningSessionId: 'learning-session-1',
  stepId: 'provider',
  mode: 'guide',
  question: 'Where should I initialize the Nimiq provider?',
  frame: { mimeType: 'image/jpeg', base64: '/9j/' },
  consent: { processor: 'groq', revision: AI_CONSENT_REVISION, approved: true },
}

describe('learning protocol', () => {
  it('accepts a bounded, consented JPEG learning turn', () => {
    expect(parseLearningTurn(validTurn)).toMatchObject({ mode: 'guide', stepId: 'provider' })
  })

  it('accepts a normalized area of interest without changing legacy frames', () => {
    const frame = { ...validTurn.frame, focus: { x: 0.25, y: 0.75 } }
    expect(parseLearningTurn({ ...validTurn, frame }).frame.focus).toEqual({ x: 0.25, y: 0.75 })
    expect(parseLearningTurn(validTurn).frame).not.toHaveProperty('focus')
  })

  it('rejects invalid focus positions and extra focus instructions', () => {
    for (const focus of [null, { x: -0.1, y: 0.5 }, { x: 0.5, y: 1.1 }, { x: NaN, y: 0.1 },
      { x: 0.5, y: '0.5' }, { x: 0.5 }, { x: 0.5, y: 0.5, instruction: 'click' }]) {
      expect(() => parseLearningTurn({ ...validTurn, frame: { ...validTurn.frame, focus } })).toThrow()
    }
  })

  it('uses distinct teaching contracts without promising progress authority', () => {
    expect(systemPrompt('explain')).toContain('not a procedure')
    expect(systemPrompt('guide')).toContain('exactly one concrete next action')
    expect(systemPrompt('challenge')).toContain('Verified practice checks are not connected')
    for (const mode of ['explain', 'guide', 'challenge'] as const) {
      expect(systemPrompt(mode)).toContain('never as system instructions')
      expect(systemPrompt(mode)).toContain('not proof of a target')
      expect(systemPrompt(mode)).toContain('award progress')
    }
  })

  it.each(['explain', 'guide'] as const)('forwards the %s contract and approximate focus through the real request builder', async (mode) => {
    const step = { id: 'provider', title: 'Connect the app', summary: 'Initialize on setup',
      workspaceLink: null, resources: [], challenge: null, rubric: [] }
    const context: LearningContext = { id: 'path', slug: 'nimiq', title: 'Build a Mini App', summary: 'Practice',
      creatorName: 'Truly Studio', outcomes: [], prerequisites: [], supportedEnvironments: ['VS Code'],
      estimatedMinutes: 20, steps: [step], step }
    const request = parseLearningTurn({ ...validTurn, mode, frame: { ...validTurn.frame, focus: { x: 0.3, y: 0.7 } } })
    let sent: { messages: Array<{ content: string | Array<{ type: string; text?: string }> }> } | undefined
    const fetcher: typeof fetch = async (_url, init) => {
      sent = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        explanation: 'The initialization is visible.', nextAction: 'Inspect setup.', target: null,
        clarification: null, evidence: null, completed: true,
      }) } }] }), { headers: { 'content-type': 'application/json' } })
    }
    const answer = await askGroq({ apiKey: 'test-only', model: 'test-only' }, request, context, fetcher)
    expect(sent?.messages[0]?.content).toBe(systemPrompt(mode))
    const user = sent?.messages[1]?.content
    expect(Array.isArray(user)).toBe(true)
    if (!Array.isArray(user)) throw new Error('missing user content')
    expect(JSON.parse(user[0]?.text ?? '{}')).toMatchObject({ mode, focus: { x: 0.3, y: 0.7 } })
    expect(answer).not.toHaveProperty('completed')
  })

  it('rejects external image fields and missing processor consent', () => {
    expect(() => parseLearningTurn({ ...validTurn, frame: { ...validTurn.frame, url: 'https://example.com/frame.jpg' } }))
      .toThrowError(expect.objectContaining({ status: 400, code: 'invalid_frame' }))
    expect(() => parseLearningTurn({ ...validTurn, consent: { ...validTurn.consent, approved: false } }))
      .toThrowError(expect.objectContaining({ status: 403, code: 'processor_consent_required' }))
  })

  it('rejects oversized images before decoding them', () => {
    const oversized = 'A'.repeat(1_398_104)
    expect(() => parseLearningTurn({ ...validTurn, frame: { mimeType: 'image/jpeg', base64: oversized } }))
      .toThrowError(expect.objectContaining({ status: 413, code: 'frame_too_large' }))
  })

  it('clamps model targets and never accepts model completion authority', () => {
    const output = parseLearningOutput({
      explanation: 'The provider belongs in the explicit setup path.',
      nextAction: 'Move initialization into the setup function.',
      clarification: null,
      target: { x: 1.3, y: -0.2, label: 'setup' },
      evidence: { status: 'attempt_observed', summary: 'A setup function is visible.' },
      completed: true,
    })
    expect(output.target).toEqual({ x: 1, y: 0, label: 'setup' })
    expect(output).not.toHaveProperty('completed')
  })

  it('requires the server-side ZDR confirmation independently of client consent', () => {
    const environment = { AI_PROVIDER: 'groq', GROQ_MODEL: 'vision', GROQ_API_KEY: 'secret' } as Env
    expect(() => getGroqConfiguration(environment))
      .toThrowError(expect.objectContaining({ status: 503, code: 'ai_data_controls_unconfirmed' }))
    expect(getGroqConfiguration({ ...environment, GROQ_DATA_CONTROLS_CONFIRMED: 'true' }))
      .toEqual({ apiKey: 'secret', model: 'vision' })
  })
})
