import { describe, expect, it } from 'vitest'
import { getGroqConfiguration } from '../src/learning/groq'
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
