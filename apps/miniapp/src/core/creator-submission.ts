interface SubmissionStep {
  title: string
  summary: string
  challenge: string | null
  rubric: string[]
}

interface SubmissionDocument {
  title: string
  summary: string
  description: string
  category: string
  language: string
  outcomes: string[]
  supportedEnvironments: string[]
  steps: SubmissionStep[]
}

export function creatorSubmissionIssues(document: SubmissionDocument): string[] {
  const issues: string[] = []
  if (!document.title.trim()) issues.push('title')
  if (!document.summary.trim()) issues.push('short summary')
  if (!document.description.trim()) issues.push('description')
  if (!document.category.trim()) issues.push('subject')
  if (!document.language.trim()) issues.push('language')
  if (!document.outcomes.some(value => value.trim())) issues.push('at least one outcome')
  if (!document.supportedEnvironments.some(value => value.trim())) issues.push('at least one tool or environment')
  if (!document.steps.length) issues.push('at least one step')
  document.steps.forEach((step, index) => {
    const prefix = `step ${index + 1}`
    if (!step.title.trim()) issues.push(`${prefix} title`)
    if (!step.summary.trim()) issues.push(`${prefix} instructions`)
    if (!step.challenge?.trim()) issues.push(`${prefix} practice challenge`)
    if (!step.rubric.some(value => value.trim())) issues.push(`${prefix} completion criteria`)
  })
  return issues
}
