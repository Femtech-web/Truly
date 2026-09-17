import { HttpError } from '../http'

export const AI_CONSENT_REVISION = 'groq-learning-v2'
export const MAX_AI_REQUEST_BYTES = 1_420_000
export const MAX_FRAME_BYTES = 1_048_576

export type LearningMode = 'explain' | 'guide' | 'challenge'

export interface LearningTurnRequest {
  learningSessionId: string
  stepId: string
  mode: LearningMode
  question: string
  frame: { mimeType: 'image/jpeg'; base64: string; focus?: { x: number; y: number } }
  consent: { processor: 'groq'; revision: typeof AI_CONSENT_REVISION; approved: true }
}

export interface LearningTurnOutput {
  explanation: string
  nextAction: string
  clarification: string | null
  target: { x: number; y: number; label: string | null } | null
  evidence: { status: 'not_evaluated' | 'needs_more_evidence' | 'attempt_observed'; summary: string } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function boundedString(value: unknown, maximum: number, field: string): string {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_learning_turn', 'Truly could not send that question. Try again.')
  const normalized = value.trim()
  if (!normalized || normalized.length > maximum) {
    throw new HttpError(400, 'invalid_learning_turn', 'Keep the question brief, then try again.')
  }
  return normalized
}

function identifier(value: unknown, field: string): string {
  const normalized = boundedString(value, 96, field)
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new HttpError(400, 'invalid_learning_turn', 'Truly could not start this learning step. Refresh and try again.')
  }
  return normalized
}

function validateJpeg(base64: unknown): string {
  if (typeof base64 !== 'string' || base64.length === 0 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new HttpError(400, 'invalid_frame', 'Truly could not read that shared screen. Capture it again.')
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const decodedBytes = (base64.length * 3) / 4 - padding
  if (decodedBytes > MAX_FRAME_BYTES) throw new HttpError(413, 'frame_too_large', 'That shared screen is too large. Capture it again.')
  try {
    const prefix = atob(base64.slice(0, 8))
    if (prefix.charCodeAt(0) !== 0xff || prefix.charCodeAt(1) !== 0xd8 || prefix.charCodeAt(2) !== 0xff) {
      throw new Error('not jpeg')
    }
  } catch {
    throw new HttpError(400, 'invalid_frame', 'Truly could not read that shared screen. Capture it again.')
  }
  return base64
}

export function parseLearningTurn(value: unknown): LearningTurnRequest {
  if (!isRecord(value) || !exactKeys(value, ['learningSessionId', 'stepId', 'mode', 'question', 'frame', 'consent'])) {
    throw new HttpError(400, 'invalid_learning_turn', 'Truly could not send that question. Capture the screen and try again.')
  }
  if (value.mode !== 'explain' && value.mode !== 'guide' && value.mode !== 'challenge') {
    throw new HttpError(400, 'invalid_learning_turn', 'Choose Explain or Guide, then try again.')
  }
  if (!isRecord(value.frame) || !exactKeys(value.frame, ['mimeType', 'base64', 'focus']) || value.frame.mimeType !== 'image/jpeg') {
    throw new HttpError(400, 'invalid_frame', 'Truly could not read that shared screen. Capture it again.')
  }
  let focus: { x: number; y: number } | undefined
  if (value.frame.focus !== undefined) {
    const point = value.frame.focus
    if (!isRecord(point) || !exactKeys(point, ['x', 'y']) || typeof point.x !== 'number' || typeof point.y !== 'number' ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      throw new HttpError(400, 'invalid_frame', 'Truly could not identify that area. Share your screen again.')
    }
    focus = { x: point.x, y: point.y }
  }
  if (!isRecord(value.consent) || !exactKeys(value.consent, ['processor', 'revision', 'approved']) ||
      value.consent.processor !== 'groq' || value.consent.revision !== AI_CONSENT_REVISION || value.consent.approved !== true) {
    throw new HttpError(403, 'processor_consent_required', 'Turn on AI help in Truly before asking a question.')
  }

  return {
    learningSessionId: identifier(value.learningSessionId, 'learningSessionId'),
    stepId: identifier(value.stepId, 'stepId'),
    mode: value.mode,
    question: boundedString(value.question, 2_000, 'question'),
    frame: { mimeType: 'image/jpeg', base64: validateJpeg(value.frame.base64), ...(focus ? { focus } : {}) },
    consent: { processor: 'groq', revision: AI_CONSENT_REVISION, approved: true },
  }
}

function optionalText(value: unknown, maximum: number, field: string): string | null {
  if (value === null || value === undefined || value === '') return null
  return boundedString(value, maximum, field)
}

export function parseLearningOutput(value: unknown): LearningTurnOutput {
  if (!isRecord(value)) throw new HttpError(502, 'invalid_ai_response', 'AI help returned an unexpected answer. Please try again.')
  const explanation = boundedString(value.explanation, 1_600, 'explanation')
  const nextAction = boundedString(value.nextAction, 500, 'nextAction')
  const clarification = optionalText(value.clarification, 500, 'clarification')

  let target: LearningTurnOutput['target'] = null
  if (value.target !== null && value.target !== undefined) {
    if (!isRecord(value.target) || typeof value.target.x !== 'number' || typeof value.target.y !== 'number' ||
        !Number.isFinite(value.target.x) || !Number.isFinite(value.target.y)) {
      throw new HttpError(502, 'invalid_ai_response', 'AI help could not point to the right place. Please try again.')
    }
    target = {
      x: Math.max(0, Math.min(1, value.target.x)),
      y: Math.max(0, Math.min(1, value.target.y)),
      label: optionalText(value.target.label, 120, 'target.label'),
    }
  }

  let evidence: LearningTurnOutput['evidence'] = null
  if (value.evidence !== null && value.evidence !== undefined) {
    if (!isRecord(value.evidence) ||
        (value.evidence.status !== 'not_evaluated' && value.evidence.status !== 'needs_more_evidence' && value.evidence.status !== 'attempt_observed')) {
      throw new HttpError(502, 'invalid_ai_response', 'AI help could not check that attempt. Please try again.')
    }
    evidence = { status: value.evidence.status, summary: boundedString(value.evidence.summary, 500, 'evidence.summary') }
  }

  return { explanation, nextAction, clarification, target, evidence }
}
