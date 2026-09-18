import { createIdempotencyKey } from './idempotency'
export { moveItem } from './reorder'
export interface CreatorLink { title: string; url: string }
export interface CreatorStep {
  id: string; title: string; summary: string; workspaceLink: CreatorLink | null; resources: CreatorLink[]
  challenge: string | null; rubric: string[]; hints: string[]
}
export interface CreatorDocument {
  slug: string; title: string; summary: string; description: string; category: string; language: string
  outcomes: string[]; prerequisites: string[]; supportedEnvironments: string[]; estimatedMinutes: number
  tags: string[]; priceNim: string | null; steps: CreatorStep[]
}
export interface CreatorDraft {
  id: string; skillId: string; baseVersion: number; revision: number; status: 'draft' | 'review' | 'rejected' | 'published'
  reviewNote: string; document: CreatorDocument
}
export interface CreatorProfile { slug: string; displayName: string; bio: string; avatarUrl: string | null; nimiqAddress: string; status: string }
export interface StudioLibrary {
  creator: CreatorProfile; drafts: CreatorDraft[]; paths: { id: string; title: string; version: number }[]
  canReview: boolean
  tags: { slug: string; label: string; family: string }[]
}

export const newCreatorStep = (): CreatorStep => ({ id: createIdempotencyKey(), title: '', summary: '', workspaceLink: null, resources: [], challenge: '', rubric: [], hints: [] })
export const newCreatorDocument = (): CreatorDocument => ({ slug: `new-path-${createIdempotencyKey().slice(0, 8)}`, title: '', summary: '', description: '',
  category: '', language: 'English', outcomes: [], prerequisites: [], supportedEnvironments: [], estimatedMinutes: 30, tags: [], priceNim: null, steps: [newCreatorStep()] })
