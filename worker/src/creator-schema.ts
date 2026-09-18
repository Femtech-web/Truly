import { HttpError } from './http'
import { parseLearningLink, parseLearningLinks } from './learning/resources'
import type { LearningStep } from './learning/access'

export interface CreatorDocument {
  slug: string; title: string; summary: string; description: string; category: string; language: string
  outcomes: string[]; prerequisites: string[]; supportedEnvironments: string[]; estimatedMinutes: number
  tags: string[]; priceNim: string | null; steps: (LearningStep & { hints: string[] })[]
}
function text(value: unknown, limit: number, label: string): string {
  if (typeof value !== 'string' || value.trim().length > limit) throw new Error(`${label}: check the text (maximum ${limit} characters).`)
  return value.trim()
}
function list(value: unknown, label: string, limit = 8, length = 240): string[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error(`${label}: use at most ${limit} entries.`)
  return value.map(item => text(item, length, label)).filter(Boolean)
}
export function nimAtomic(value: string): string {
  if (!/^(0|[1-9]\d{0,8})(\.\d{1,5})?$/.test(value)) throw new Error('Price: enter NIM with at most five decimal places.')
  const [whole, fraction = ''] = value.split('.')
  const amount = BigInt(whole!) * 100000n + BigInt(fraction.padEnd(5, '0'))
  if (amount <= 0n) throw new Error('Price: use a positive amount, or choose Free.')
  return amount.toString()
}
export function creatorDocument(value: unknown, submitting = false): CreatorDocument {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Check the Path document.')
    const v = value as Record<string, unknown>
    const slug = text(v.slug, 80, 'Path link')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Path link: use lowercase letters, numbers and hyphens.')
    if (!Array.isArray(v.steps) || v.steps.length > 24) throw new Error('Use at most 24 steps.')
    const ids = new Set<string>()
    const steps = v.steps.map((value, index) => {
      if (!value || typeof value !== 'object') throw new Error(`Check step ${index + 1}.`)
      const step = value as Record<string, unknown>
      const id = text(step.id, 80, 'Step ID')
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new Error('Step IDs must be distinct.')
      ids.add(id)
      const result = { id, title: text(step.title, 120, 'Step title'), summary: text(step.summary, 2000, 'Instructions'),
        workspaceLink: parseLearningLink(step.workspaceLink), resources: parseLearningLinks(step.resources),
        challenge: text(step.challenge ?? '', 500, 'Challenge') || null, rubric: list(step.rubric, 'Completion criteria'), hints: list(step.hints ?? [], 'Hints') }
      if (submitting && (!result.title || !result.summary || !result.challenge || !result.rubric.length))
        throw new Error(`Step ${index + 1} needs a title, instructions, a challenge and visible completion criteria.`)
      return result
    })
    const priceNim = v.priceNim === null ? null : text(v.priceNim, 20, 'Price')
    if (priceNim !== null) nimAtomic(priceNim)
    const document = { slug, title: text(v.title, 120, 'Title'), summary: text(v.summary, 300, 'Summary'),
      description: text(v.description, 4000, 'Description'), category: text(v.category, 80, 'Subject'), language: text(v.language, 40, 'Language'),
      outcomes: list(v.outcomes, 'Outcomes'), prerequisites: list(v.prerequisites, 'Prerequisites'),
      supportedEnvironments: list(v.supportedEnvironments, 'Tools'), estimatedMinutes: Number(v.estimatedMinutes),
      tags: list(v.tags, 'Tags', 12, 80), priceNim, steps }
    if (!Number.isSafeInteger(document.estimatedMinutes) || document.estimatedMinutes < 1 || document.estimatedMinutes > 10080)
      throw new Error('Estimated time: use 1–10080 minutes.')
    if (submitting && (!document.title || !document.summary || !document.description || !document.category || !document.language ||
      !document.outcomes.length || !document.supportedEnvironments.length || !steps.length))
      throw new Error('Add a title, summary, description, subject, language, outcome, tool and at least one complete step.')
    return document
  } catch (error) {
    throw new HttpError(400, 'invalid_creator_path', error instanceof Error ? error.message : 'Check this Path before saving.')
  }
}
