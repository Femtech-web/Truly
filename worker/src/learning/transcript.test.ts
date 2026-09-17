import { describe, expect, it } from 'vitest'
import { inspectTranscript } from './transcript'

const segment = { text: 'Explain this function', no_speech_prob: 0.01, avg_logprob: -0.2, compression_ratio: 1.1 }
const sample = (changes = {}) => ({ text: ' Explain this function ', segments: [{ ...segment, ...changes }] })

describe('voice transcript screening', () => {
  it('accepts a clear question without adding fallback text', () => {
    expect(inspectTranscript(sample())).toEqual({ text: 'Explain this function', requiresReview: false })
  })
  it('asks the learner to review uncertain or repetitive speech', () => {
    for (const changes of [{ avg_logprob: -1.3 }, { no_speech_prob: 0.7 }, { compression_ratio: 2.5 }]) {
      expect(inspectTranscript(sample(changes)).requiresReview).toBe(true)
    }
  })
  it('rejects likely silence even if Whisper emits words', () => {
    expect(() => inspectTranscript(sample({ no_speech_prob: 0.99 }))).toThrow('did not hear')
  })
  it('rejects missing or malformed evidence', () => {
    for (const value of [null, {}, { text: 'hello' }, { text: 'hello', segments: [] }, sample({ no_speech_prob: NaN }),
      sample({ no_speech_prob: -1 }), sample({ avg_logprob: undefined }), sample({ compression_ratio: Infinity }),
      sample({ text: '' }), { ...sample(), text: 'x'.repeat(2_001) }]) {
      expect(() => inspectTranscript(value)).toThrow('did not hear')
    }
  })
  it('preserves the original words and requires review for mixed silence and speech', () => {
    expect(inspectTranscript({ text: 'my question', segments: [segment, { ...segment, no_speech_prob: 0.99 }] }))
      .toEqual({ text: 'my question', requiresReview: true })
  })
})
