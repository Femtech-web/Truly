import { HttpError, json } from '../http'
import { consumeLimit } from '../rate-limits'
import { authenticateDesktop } from '../sessions'
import type { Env } from '../types'
import { getGroqConfiguration } from './groq'
import { AI_CONSENT_REVISION } from './protocol'
import { inspectTranscript } from './transcript'

const MAX_AUDIO_BYTES = 5 * 1024 * 1024
const allowedTypes = new Set(['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/mpeg', 'audio/webm'])

export async function transcribeVoice(request: Request, env: Env): Promise<Response> {
  const identity = await authenticateDesktop(request, env)
  if (request.headers.get('x-truly-consent-revision') !== AI_CONSENT_REVISION) {
    throw new HttpError(403, 'processor_consent_required', 'Turn on AI help in Truly before asking by voice.')
  }
  const configuration = getGroqConfiguration(env)
  const lengthHeader = request.headers.get('content-length')
  const declared = lengthHeader ? Number(lengthHeader) : Number.NaN
  if (!Number.isFinite(declared) || declared <= 0) {
    throw new HttpError(411, 'audio_length_required', 'Truly could not verify that recording. Try again.')
  }
  if (declared > MAX_AUDIO_BYTES + 100_000) {
    throw new HttpError(413, 'audio_too_large', 'Keep the spoken question under 30 seconds, then try again.')
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('multipart/form-data')) {
    throw new HttpError(415, 'unsupported_media_type', 'Truly could not read that recording. Try again.')
  }
  const form = await request.formData()
  const audio = form.get('audio')
  if (!(audio instanceof File) || audio.size < 32 || audio.size > MAX_AUDIO_BYTES || !allowedTypes.has(audio.type.toLowerCase())) {
    throw new HttpError(400, 'invalid_audio', 'Truly could not read that recording. Hold the microphone and try again.')
  }

  await consumeLimit(env, `voice-device:${identity.deviceId}`, 10)
  const upstream = new FormData()
  upstream.set('file', audio, audio.name || 'question.m4a')
  upstream.set('model', env.GROQ_TRANSCRIPTION_MODEL?.trim() || 'whisper-large-v3-turbo')
  upstream.set('response_format', 'verbose_json')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { authorization: `Bearer ${configuration.apiKey}` }, body: upstream, signal: controller.signal,
    })
    if (!response.ok) {
      if (response.status === 429) throw new HttpError(503, 'voice_busy', 'Voice is busy right now. Wait a moment, then try again.')
      throw new HttpError(502, 'transcription_failed', 'Truly could not understand that recording. Try again.')
    }
    const raw = await response.text()
    if (new TextEncoder().encode(raw).byteLength > 64_000) throw new Error('response too large')
    return json(inspectTranscript(JSON.parse(raw)))
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new HttpError(504, 'transcription_timeout', 'Voice took too long. Try again.')
    }
    throw new HttpError(502, 'transcription_failed', 'Truly could not understand that recording. Try again.')
  } finally {
    clearTimeout(timeout)
  }
}
