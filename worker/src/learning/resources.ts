import { HttpError } from '../http'

export interface LearningLink {
  title: string
  url: string
}

function plainText(value: unknown, maximum: number): string {
  if (typeof value !== 'string') throw new Error('invalid text')
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized || normalized.length > maximum) throw new Error('invalid text')
  return normalized
}

function reviewedUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2_048) throw new Error('invalid url')
  const parsed = new URL(value.trim())
  const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !localHttp) throw new Error('invalid url')
  if (parsed.username || parsed.password) throw new Error('invalid url')
  return parsed.toString()
}

export function parseLearningLink(value: unknown): LearningLink | null {
  if (value === null || value === undefined || value === '') return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid link')
  const input = value as Record<string, unknown>
  return { title: plainText(input.title, 90), url: reviewedUrl(input.url) }
}

export function parseLearningLinks(value: unknown, maximum = 8): LearningLink[] {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value) || value.length > maximum) throw new Error('invalid resources')
  return value.map((item) => {
    const link = parseLearningLink(item)
    if (!link) throw new Error('invalid resource')
    return link
  })
}

export function parseTaskWorkspaceUrl(value: unknown): LearningLink | null {
  if (value === null || value === undefined || value === '') return null
  try { return { title: 'Starting point', url: reviewedUrl(value) } } catch {
    throw new HttpError(400, 'invalid_workspace_link', 'Use a secure web link, or a local development link from this Mac.')
  }
}

export function parseTaskResources(value: unknown): LearningLink[] {
  try { return parseLearningLinks(value) } catch {
    throw new HttpError(400, 'invalid_task_resources', 'Check the resource names and links, then try again.')
  }
}

export function parseStoredResources(value: string): LearningLink[] {
  try { return parseLearningLinks(JSON.parse(value)) } catch { return [] }
}
