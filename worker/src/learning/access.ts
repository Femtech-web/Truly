import { HttpError } from '../http'
import type { Env } from '../types'
import { parseLearningLink, parseLearningLinks, type LearningLink } from './resources'

interface RuntimeRow {
  id: string
  slug: string
  title: string
  summary: string
  creator_name: string
  manifest_json: string
  access_kind: string
  publication_json: string
  entitlement_count: number
}

export interface SkillManifest {
  outcomes: string[]
  prerequisites: string[]
  supportedEnvironments: string[]
  estimatedMinutes: number | null
  steps: LearningStep[]
}

export interface LearningStep {
  id: string
  title: string
  summary: string
  workspaceLink: LearningLink | null
  resources: LearningLink[]
  challenge: string | null
  rubric: string[]
}

export interface LearningContext {
  id: string
  slug: string
  title: string
  summary: string
  creatorName: string
  outcomes: string[]
  prerequisites: string[]
  supportedEnvironments: string[]
  estimatedMinutes: number | null
  steps: LearningStep[]
  step: LearningStep
}

function optionalText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new Error('bad text')
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized || normalized.length > maximum) throw new Error('bad text')
  return normalized
}

function rubric(value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value) || value.length > 8) throw new Error('bad rubric')
  return value.map((item) => optionalText(item, 240)).filter((item): item is string => Boolean(item))
}

export function parseManifest(raw: string): SkillManifest {
  try {
    const value = JSON.parse(raw) as Partial<SkillManifest>
    if (!Array.isArray(value.outcomes) || !value.outcomes.every((item) => typeof item === 'string') ||
        !Array.isArray(value.supportedEnvironments) || !value.supportedEnvironments.every((item) => typeof item === 'string') ||
        !Array.isArray(value.steps) || !value.steps.every((step) => step && typeof step.id === 'string' && typeof step.title === 'string')) {
      throw new Error('bad manifest')
    }
    return {
      outcomes: value.outcomes,
      prerequisites: Array.isArray(value.prerequisites) && value.prerequisites.every((item) => typeof item === 'string')
        ? value.prerequisites : [],
      supportedEnvironments: value.supportedEnvironments,
      estimatedMinutes: Number.isSafeInteger(value.estimatedMinutes) && Number(value.estimatedMinutes) > 0
        ? Number(value.estimatedMinutes) : null,
      steps: value.steps.map((step) => {
        const input = step as unknown as Record<string, unknown>
        return {
          id: step.id,
          title: step.title,
          summary: typeof step.summary === 'string' ? step.summary : '',
          workspaceLink: parseLearningLink(input.workspaceLink),
          resources: parseLearningLinks(input.resources),
          challenge: optionalText(input.challenge, 500),
          rubric: rubric(input.rubric),
        }
      }),
    }
  } catch {
    throw new HttpError(503, 'skill_runtime_unavailable', 'This Path is not ready to start on Mac yet.')
  }
}

export async function resolveSkillVersion(env: Env, walletAddress: string, skillId: string, skillVersion: number): Promise<LearningContext> {
  const row = await env.DB.prepare(
    `SELECT skills.id, skills.slug, skills.title, skills.summary, creators.display_name AS creator_name,
            skill_versions.manifest_json, skill_versions.access_kind, skill_versions.publication_json,
            (SELECT COUNT(*) FROM entitlements WHERE entitlements.skill_id = skills.id AND entitlements.wallet_address = ?) AS entitlement_count
     FROM skills JOIN skill_versions ON skill_versions.skill_id = skills.id
     JOIN creators ON creators.id = skills.creator_id
     WHERE skills.id = ? AND skill_versions.version = ? AND skills.status = 'published'
       AND skill_versions.review_status = 'approved' LIMIT 1`,
  ).bind(walletAddress, skillId, skillVersion).first<RuntimeRow>()

  if (!row) throw new HttpError(404, 'skill_version_not_found', 'This Path is no longer available. Refresh and choose it again.')
  if (row.access_kind === 'paid' && Number(row.entitlement_count) < 1) {
    throw new HttpError(403, 'skill_entitlement_required', 'Unlock this Path in Truly before starting it on your Mac.')
  }

  const manifest = parseManifest(row.manifest_json)
  const publication = JSON.parse(row.publication_json) as { title?: string; summary?: string; creatorName?: string }
  const step = manifest.steps[0]
  if (!step) throw new HttpError(503, 'skill_runtime_unavailable', 'The guided steps for this Path are not ready yet.')

  return {
    id: row.id,
    slug: row.slug,
    title: publication.title ?? row.title,
    summary: publication.summary ?? row.summary,
    creatorName: publication.creatorName ?? row.creator_name,
    outcomes: manifest.outcomes.slice(0, 8),
    prerequisites: manifest.prerequisites.slice(0, 8),
    supportedEnvironments: manifest.supportedEnvironments.slice(0, 8),
    estimatedMinutes: manifest.estimatedMinutes,
    steps: manifest.steps.slice(0, 24),
    step,
  }
}
