export type CreatorDraftStatus = 'draft' | 'review' | 'rejected' | 'published'

export const canDeleteCreatorDraft = (status: CreatorDraftStatus) => status === 'draft' || status === 'rejected'
