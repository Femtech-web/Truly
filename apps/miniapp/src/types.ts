export type AppTab = 'home' | 'learn' | 'devices' | 'progress' | 'wallet'

export type LearnView = 'tasks' | 'paths'

export interface LearningLink {
  title: string
  url: string
}

export type SkillId = string

export interface Lesson {
  title: string
  detail: string
  state: 'complete' | 'current' | 'next'
  workspaceLink: LearningLink | null
  resources: LearningLink[]
  challenge: string | null
  rubric: string[]
}

export interface Skill {
  id: SkillId
  eyebrow: string
  title: string
  description: string
  outcome: string
  price: number
  progress: number
  lessons: Lesson[]
  outcomes: string[]
  prerequisites: string[]
  supportedEnvironments: string[]
  estimatedMinutes: number | null
  theme: 'mint' | 'violet'
  creator: { slug: string; displayName: string; bio: string }
  version: number
  tags: { slug: string; label: string; family: string }[]
  runtimeReady: boolean
  prices: { asset: 'NIM' | 'USDT'; amountAtomic: string; decimals: number; active: number }[]
}

export interface Device {
  id: string
  name: string
  platform: string
  status: 'active' | 'revoked'
}

export interface ActiveLearningSession {
  id: string
  status: 'active' | 'paused' | 'completed'
  device: { id: string; name: string }
  source: {
    kind: 'path' | 'task'
    id: string
    taskId: string | null
    title: string
    summary: string
    creatorName: string | null
    version: number | null
    outcomes: string[]
    prerequisites: string[]
    supportedEnvironments: string[]
    estimatedMinutes: number | null
    stepCount: number
    workspaceLink: LearningLink | null
    resources: LearningLink[]
  }
  currentStep: {
    id: string
    title: string
    summary: string
    index: number
    total: number
    workspaceLink: LearningLink | null
    resources: LearningLink[]
    challenge: string | null
    rubric: string[]
  }
  startedAt: string
  updatedAt: string
}

export interface LearningTask {
  id: string
  goal: string
  title: string
  outcome: string
  steps: Array<{ id: string; title: string; summary: string }>
  workspaceLink: LearningLink | null
  resources: LearningLink[]
  source: { kind: 'direct' | 'path'; pathId: string | null; pathVersion: number | null; creatorName: string | null }
  status: 'draft' | 'active' | 'completed' | 'archived'
  createdAt: string
  updatedAt: string
}
