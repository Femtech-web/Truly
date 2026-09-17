import { useCallback, useEffect, useState } from 'react'
import { coreRequest } from '../core/client'
import type { LearningLink, Skill } from '../types'

interface CatalogSkill {
  id: string
  title: string
  summary: string
  description: string
  category: string
  currentVersion: number
  creator: Skill['creator']
  tags: Skill['tags']
  prices: Skill['prices']
  outcomes: string[]
  prerequisites: string[]
  supportedEnvironments: string[]
  estimatedMinutes: number | null
  steps: Array<{
    id: string
    title: string
    summary: string
    workspaceLink: LearningLink | null
    resources: LearningLink[]
    challenge: string | null
    rubric: string[]
  }>
  runtimeReady: boolean
}

export function useCatalog() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setStatus('loading')
    setMessage(null)
    try {
      const result = await coreRequest<{ skills: CatalogSkill[] }>('/v1/catalog')
      setSkills(result.skills.map((skill, index) => ({
        id: skill.id,
        title: skill.title,
        eyebrow: skill.category,
        description: skill.summary,
        outcome: skill.description,
        price: Number(skill.prices.find((price) => price.asset === 'NIM')?.amountAtomic ?? 0) / 100_000,
        prices: skill.prices,
        progress: 0,
        lessons: skill.steps.map((step, stepIndex) => ({
          title: step.title,
          detail: step.summary,
          state: stepIndex === 0 ? 'current' : 'next',
          workspaceLink: step.workspaceLink,
          resources: step.resources,
          challenge: step.challenge,
          rubric: step.rubric,
        })),
        outcomes: skill.outcomes,
        prerequisites: skill.prerequisites,
        supportedEnvironments: skill.supportedEnvironments,
        estimatedMinutes: skill.estimatedMinutes,
        theme: index % 2 === 0 ? 'mint' : 'violet',
        creator: skill.creator,
        version: skill.currentVersion,
        tags: skill.tags,
        runtimeReady: skill.runtimeReady,
      })))
      setStatus('ready')
    } catch (error) {
      setSkills([])
      setStatus('failed')
      setMessage(error instanceof Error ? error.message : 'Truly could not load the Paths. Please try again.')
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  return { skills, status, message, reload }
}
