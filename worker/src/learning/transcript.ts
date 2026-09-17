import { HttpError } from '../http'

const unclear = () => new HttpError(422, 'unclear_speech', 'Truly did not hear a clear question. Try again, or type it instead.')

/** Confidence is a screening signal, not proof of what the learner said. */
export function inspectTranscript(value: unknown): { text: string; requiresReview: boolean } {
  if (!value || typeof value !== 'object') throw unclear()
  const result = value as Record<string, unknown>
  const text = typeof result.text === 'string' ? result.text.trim() : ''
  if (!text || text.length > 2_000 || !Array.isArray(result.segments) || !result.segments.length) throw unclear()
  let likelySpeech = false
  let requiresReview = false
  for (const item of result.segments) {
    if (!item || typeof item !== 'object') throw unclear()
    const segment = item as Record<string, unknown>
    const noSpeech = segment.no_speech_prob
    const logProbability = segment.avg_logprob
    const compression = segment.compression_ratio
    if (typeof noSpeech !== 'number' || !Number.isFinite(noSpeech) || noSpeech < 0 || noSpeech > 1 ||
        typeof logProbability !== 'number' || !Number.isFinite(logProbability) ||
        typeof compression !== 'number' || !Number.isFinite(compression) || compression < 0) throw unclear()
    if (typeof segment.text !== 'string' || !segment.text.trim()) continue
    if (noSpeech < 0.8) likelySpeech = true
    if (noSpeech > 0.6 || logProbability < -1 || compression > 2.4) requiresReview = true
  }
  if (!likelySpeech) throw unclear()
  return { text, requiresReview }
}
