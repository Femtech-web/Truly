import { describe, expect, it } from 'vitest'
import { parseAssessment, assessmentPassed } from '../src/learning/assessment'

const result = { feedback: 'The required work is visible.', criteria: [
  { index: 0, status: 'met', confidence: 0.95, evidence: 'The SDK import and init call are visible.' },
  { index: 1, status: 'met', confidence: 0.94, evidence: 'Account access is inside the click callback.' },
] }

describe('practice assessment policy', () => {
  it('requires every criterion with concrete evidence and high confidence', () => {
    expect(assessmentPassed(parseAssessment(result, 2))).toBe(true)
    for (const change of [{ status: 'not_met' }, { status: 'unclear' }, { confidence: 0.84 }, { evidence: '' }]) {
      const input = { ...result, criteria: [result.criteria[0], { ...result.criteria[1], ...change }] }
      if (change.evidence === '') expect(() => parseAssessment(input, 2)).toThrow()
      else expect(assessmentPassed(parseAssessment(input, 2))).toBe(false)
    }
  })
  it('rejects omissions, duplicates, extra criteria and malformed model authority', () => {
    for (const criteria of [[], [result.criteria[0]], [result.criteria[0], result.criteria[0]],
      [...result.criteria, result.criteria[0]], [{ ...result.criteria[0], index: -1 }, result.criteria[1]],
      [{ ...result.criteria[0], confidence: '1' }, result.criteria[1]],
      [{ ...result.criteria[0], confidence: NaN }, result.criteria[1]],
      [{ ...result.criteria[0], status: 'completed' }, result.criteria[1]]]) {
      expect(() => parseAssessment({ ...result, criteria }, 2)).toThrow()
    }
    expect(() => parseAssessment({ ...result, completed: true }, 2)).toThrow()
    expect(() => parseAssessment(result, 0)).toThrow()
  })
  it('accepts reordered evidence but never trusts a model next step', () => {
    expect(parseAssessment({ ...result, criteria: [...result.criteria].reverse() }, 2).criteria.map(c => c.index)).toEqual([0, 1])
    expect(() => parseAssessment({ ...result, nextStep: 'done' }, 2)).toThrow()
  })
})
