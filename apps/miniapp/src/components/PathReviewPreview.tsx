import type { CreatorDocument } from '../core/creator-studio'

export function PathReviewPreview({ document }: { document: CreatorDocument }) {
  return <div className="studio-preview">
    <span>{document.category} · {document.priceNim === null ? 'Free' : `${document.priceNim} NIM`}</span>
    <h2>{document.title}</h2><p>{document.summary}</p><p>{document.description}</p>
    <p>{document.estimatedMinutes} minutes · {document.language} · {document.supportedEnvironments.join(', ')}</p>
    <p>Public link: {document.slug} · Tags: {document.tags.join(', ') || 'None'}</p>
    <h3>Outcomes</h3><ul>{document.outcomes.map((item, i) => <li key={i}>{item}</li>)}</ul>
    <h3>Prerequisites</h3><ul>{document.prerequisites.map((item, i) => <li key={i}>{item}</li>)}</ul>
    {document.steps.map((step, i) => <section key={step.id}>
      <h3>{i + 1}. {step.title}</h3><p>{step.summary}</p>
      {step.workspaceLink && <p>Starting point: {step.workspaceLink.title} · {step.workspaceLink.url}</p>}
      <ul>{step.resources.map((resource, n) => <li key={n}>{resource.title} · {resource.url}</li>)}</ul>
      <p>Challenge: {step.challenge}</p><ul>{step.rubric.map((criterion, n) => <li key={n}>{criterion}</li>)}</ul>
      {step.hints.length > 0 && <details><summary>Hints</summary>{step.hints.map((hint, n) => <p key={n}>{hint}</p>)}</details>}
    </section>)}
  </div>
}
