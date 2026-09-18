import { requireWallet } from './device-management'
import { creatorDocument, nimAtomic, type CreatorDocument } from './creator-schema'
import { HttpError, json, readJson } from './http'
import { sha256 } from './security'
import { parseLearningLink } from './learning/resources'
import type { Env } from './types'
import { isReviewer } from './reviewer'
import { creatorNimPrice } from './payments/config'

interface Creator { id: string; nimiq_address: string; slug: string; display_name: string; bio: string; avatar_url: string | null; status: string }
interface Draft { id: string; creator_id: string; skill_id: string; base_version: number; revision: number; document_json: string; status: string; review_note: string }
const openCreator = "status IN ('invited', 'active')"
const notFound = () => new HttpError(404, 'creator_draft_not_found', 'That draft is not available to this creator.')
const conflict = () => new HttpError(409, 'creator_draft_changed', 'This draft changed or is already submitted. Reload before editing.')
const draftView = (d: Draft) => ({ id: d.id, skillId: d.skill_id, baseVersion: d.base_version, revision: d.revision,
  status: d.status, reviewNote: d.review_note, document: JSON.parse(d.document_json) as CreatorDocument })
async function creator(request: Request, env: Env, scope: string): Promise<Creator> {
  const identity = await requireWallet(request, env, scope)
  const row = await env.DB.prepare(`SELECT * FROM creators WHERE nimiq_address = ? AND ${openCreator}`).bind(identity.walletAddress).first<Creator>()
  if (!row) throw new HttpError(403, 'creator_access_required', 'Approve Creator Studio to create your profile, or contact support if creator access is suspended.')
  return row
}
async function getDraft(env: Env, id: string, owner: string): Promise<Draft> {
  const row = await env.DB.prepare('SELECT * FROM creator_drafts WHERE id = ? AND creator_id = ?').bind(id, owner).first<Draft>()
  if (!row) throw notFound()
  return row
}
async function validateTags(env: Env, document: CreatorDocument) {
  const { results } = await env.DB.prepare('SELECT slug FROM tags').all<{ slug: string }>()
  const known = new Set(results.map(tag => tag.slug))
  if (new Set(document.tags).size !== document.tags.length || document.tags.some(tag => !known.has(tag)))
    throw new HttpError(400, 'invalid_creator_tags', 'Choose distinct tags from the available list.')
}
const profileView = (c: Creator) => ({ slug: c.slug, displayName: c.display_name, bio: c.bio, avatarUrl: c.avatar_url,
  nimiqAddress: c.nimiq_address, status: c.status })

export async function studioRequest(parts: string[], request: Request, env: Env): Promise<Response> {
  // Reviewer authority is server-operator-only. Never accept a browser origin or creator grant.
  if (parts[0] === 'review') return review(parts[1], request, env)
  if (parts[0] === 'reviewer' && parts.length === 1 && request.method === 'GET') {
    const identity = await requireWallet(request, env, 'devices:read')
    return json({ authorized: isReviewer(identity.walletAddress, env) })
  }
  if (parts[0] === 'review-queue' && parts.length <= 2) {
    const identity = await requireWallet(request, env, request.method === 'GET' ? 'review:read' : 'review:write')
    if (!isReviewer(identity.walletAddress, env)) throw new HttpError(403, 'reviewer_required', 'This wallet is not an authorized reviewer.')
    return reviewSnapshot(parts[1], request, env, identity.walletAddress)
  }
  const owner = await creator(request, env, request.method === 'GET' ? 'studio:read' : 'studio:write')
  if (parts.length === 1 && parts[0] === 'profile') {
    if (request.method === 'GET') return json({ creator: profileView(owner) })
    if (request.method === 'POST') {
      const body = await readJson<{ displayName?: string; bio?: string; avatarUrl?: string | null }>(request)
      if (typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 80 ||
        typeof body.bio !== 'string' || body.bio.length > 1000) throw new HttpError(400, 'invalid_creator_profile', 'Add a name (up to 80 characters) and bio (up to 1000).')
      let avatar: string | null = null
      try { avatar = body.avatarUrl ? parseLearningLink({ title: 'Avatar', url: body.avatarUrl })!.url : null
        if (avatar && !avatar.startsWith('https:')) throw new Error() }
      catch { throw new HttpError(400, 'invalid_creator_avatar', 'Use a secure HTTPS avatar link, or leave it empty.') }
      await env.DB.prepare(`UPDATE creators SET display_name = ?, bio = ?, avatar_url = ?, updated_at = ? WHERE id = ? AND ${openCreator}`)
        .bind(body.displayName.trim(), body.bio.trim(), avatar, new Date().toISOString(), owner.id).run()
      return json({ creator: profileView({ ...owner, display_name: body.displayName.trim(), bio: body.bio.trim(), avatar_url: avatar }) })
    }
  }
  if (parts.length === 1 && parts[0] === 'drafts') {
    if (request.method === 'GET') {
      const [drafts, paths, tags] = await Promise.all([
        env.DB.prepare('SELECT * FROM creator_drafts WHERE creator_id = ? ORDER BY updated_at DESC LIMIT 100').bind(owner.id).all<Draft>(),
        env.DB.prepare("SELECT id, title, current_version AS version FROM skills WHERE creator_id = ? AND status = 'published'").bind(owner.id).all(),
        env.DB.prepare('SELECT slug, label, family FROM tags ORDER BY family, label').all(),
      ])
      return json({ creator: profileView(owner), canReview: isReviewer(owner.nimiq_address, env), drafts: drafts.results.map(draftView), paths: paths.results, tags: tags.results })
    }
    if (request.method === 'POST') {
      const body = await readJson<{ id?: string; document?: unknown; skillId?: string }>(request, 65536)
      if (body.id !== undefined && (typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.id)))
        throw new HttpError(400, 'invalid_draft_id', 'Start a new draft from Creator Studio.')
      const id = body.id ?? crypto.randomUUID()
      if (body.id) {
        const previous = await env.DB.prepare('SELECT * FROM creator_drafts WHERE id = ? AND creator_id = ?').bind(id, owner.id).first<Draft>()
        if (previous) {
          if ((body.skillId && previous.skill_id !== body.skillId) || (!body.skillId && JSON.stringify(creatorDocument(body.document)) !== previous.document_json)) throw conflict()
          return json(draftView(previous))
        }
      }
      let skillId: string = crypto.randomUUID(), baseVersion = 0, document: CreatorDocument
      if (body.skillId !== undefined) {
        if (typeof body.skillId !== 'string' || body.skillId.length > 80) throw notFound()
        const path = await env.DB.prepare(`SELECT s.id, s.current_version, s.title, s.summary, s.description, s.category, s.slug, v.manifest_json
          FROM skills s JOIN skill_versions v ON v.skill_id = s.id AND v.version = s.current_version
          WHERE s.id = ? AND s.creator_id = ? AND s.status = 'published' AND v.review_status = 'approved'`).bind(body.skillId, owner.id)
          .first<{ id: string; current_version: number; title: string; summary: string; description: string; category: string; slug: string; manifest_json: string }>()
        if (!path) throw notFound()
        const existing = await env.DB.prepare("SELECT id FROM creator_drafts WHERE skill_id = ? AND status IN ('draft', 'review')").bind(path.id).first()
        if (existing) throw conflict()
        skillId = path.id; baseVersion = path.current_version
        const prices = await env.DB.prepare("SELECT amount_atomic FROM skill_prices WHERE skill_id = ? AND asset = 'NIM'").bind(path.id).first<{ amount_atomic: string }>()
        const amount = prices ? BigInt(prices.amount_atomic) : null
        const tags = await env.DB.prepare('SELECT t.slug FROM tags t JOIN skill_tags st ON st.tag_id = t.id WHERE st.skill_id = ?').bind(path.id).all<{ slug: string }>()
        document = creatorDocument({ ...JSON.parse(path.manifest_json), ...path, language: JSON.parse(path.manifest_json).language ?? 'English',
          tags: tags.results.map(tag => tag.slug), priceNim: amount === null ? null : `${amount / 100000n}.${(amount % 100000n).toString().padStart(5, '0')}` })
      } else document = creatorDocument(body.document)
      await validateTags(env, document)
      const now = new Date().toISOString()
      const statements: D1PreparedStatement[] = []
      if (!baseVersion) statements.push(env.DB.prepare(`INSERT INTO skills (id, creator_id, slug, title, summary, description, category, status)
        SELECT ?, id, ?, ?, ?, ?, ?, 'draft' FROM creators WHERE id = ? AND ${openCreator}`)
        .bind(skillId, `draft-${id}`, document.title, document.summary, document.description, document.category, owner.id))
      statements.push(env.DB.prepare(`INSERT INTO creator_drafts (id, creator_id, skill_id, base_version, document_json, updated_at)
        SELECT ?, id, ?, ?, ?, ? FROM creators WHERE id = ? AND ${openCreator}`)
        .bind(id, skillId, baseVersion, JSON.stringify(document), now, owner.id))
      try { await env.DB.batch(statements) } catch { throw conflict() }
      return json(draftView(await getDraft(env, id, owner.id)), { status: 201 })
    }
  }
  if (parts[0] === 'drafts' && parts[1] && parts.length === 2 && request.method === 'DELETE') {
    const saved = await getDraft(env, parts[1], owner.id)
    if (!['draft', 'rejected'].includes(saved.status))
      throw new HttpError(409, 'creator_draft_locked', 'Submitted drafts cannot be deleted while they are in review.')
    const results = await env.DB.batch([
      env.DB.prepare("DELETE FROM creator_drafts WHERE id = ? AND creator_id = ? AND status IN ('draft', 'rejected')")
        .bind(saved.id, owner.id),
      env.DB.prepare(`DELETE FROM skills WHERE id = ? AND creator_id = ? AND status = 'draft'
        AND NOT EXISTS (SELECT 1 FROM creator_drafts WHERE skill_id = skills.id)
        AND NOT EXISTS (SELECT 1 FROM skill_versions WHERE skill_id = skills.id)`)
        .bind(saved.skill_id, owner.id),
    ])
    if (results[0]?.meta.changes !== 1) throw conflict()
    return json({ status: 'deleted', draftId: saved.id })
  }
  if (parts[0] === 'drafts' && parts[1] && parts.length <= 3 && request.method === 'POST') {
    const saved = await getDraft(env, parts[1], owner.id)
    const body = await readJson<{ document?: unknown; revision?: number }>(request, 65536)
    if (parts[2] === 'revise') {
      if (saved.status !== 'rejected' || saved.revision !== body.revision) throw conflict()
      let result: D1Result
      try { result = await env.DB.prepare(`UPDATE creator_drafts SET status = 'draft', revision = revision + 1, publication_claim = NULL, updated_at = ?
        WHERE id = ? AND creator_id = ? AND revision = ? AND status = 'rejected'
        AND EXISTS (SELECT 1 FROM creators WHERE id = creator_drafts.creator_id AND ${openCreator})`)
        .bind(new Date().toISOString(), saved.id, owner.id, saved.revision).run() } catch { throw conflict() }
      if (result.meta.changes !== 1) throw conflict()
      return json(draftView(await getDraft(env, saved.id, owner.id)))
    }
    if (saved.status !== 'draft' || saved.revision !== body.revision) throw conflict()
    const submitting = parts[2] === 'submit'
    if (parts[2] && !submitting) throw notFound()
    const document = creatorDocument(submitting ? JSON.parse(saved.document_json) : body.document, submitting)
    await validateTags(env, document)
    const result = await env.DB.prepare(`UPDATE creator_drafts SET document_json = ?, status = ?, revision = revision + ?, updated_at = ?
      WHERE id = ? AND creator_id = ? AND revision = ? AND status = 'draft'
      AND EXISTS (SELECT 1 FROM creators WHERE id = creator_drafts.creator_id AND ${openCreator})`)
      .bind(JSON.stringify(document), submitting ? 'review' : 'draft', submitting ? 0 : 1, new Date().toISOString(), saved.id, owner.id, saved.revision).run()
    if (result.meta.changes !== 1) throw conflict()
    return json(draftView(await getDraft(env, saved.id, owner.id)))
  }
  throw new HttpError(404, 'not_found', 'That Creator Studio request was not found.')
}

async function review(id: string | undefined, request: Request, env: Env): Promise<Response> {
  const supplied = request.headers.get('authorization') ?? ''
  if (request.headers.has('origin') || !env.CREATOR_REVIEW_TOKEN ||
    await sha256(supplied) !== await sha256(`Bearer ${env.CREATOR_REVIEW_TOKEN}`))
    throw new HttpError(401, 'reviewer_required', 'A separate reviewer approval is required.')
  return reviewSnapshot(id, request, env, null)
}

async function reviewSnapshot(id: string | undefined, request: Request, env: Env, reviewerWallet: string | null): Promise<Response> {
  if (!id && request.method === 'GET') {
    const rows = await env.DB.prepare("SELECT d.* FROM creator_drafts d JOIN creators c ON c.id = d.creator_id WHERE d.status = 'review' AND c.status IN ('invited','active') ORDER BY d.updated_at LIMIT 100").all<Draft>()
    const drafts = await Promise.all(rows.results.map(async d => {
      const author = await env.DB.prepare('SELECT * FROM creators WHERE id = ?').bind(d.creator_id).first<Creator>()
      return { ...draftView(d), creator: author ? profileView(author) : null }
    }))
    return json({ drafts })
  }
  const body = await readJson<{ revision?: number; decision?: string; note?: string }>(request)
  if (!id || request.method !== 'POST' || !['published', 'rejected'].includes(body.decision ?? '') ||
    typeof body.note !== 'string' || !body.note.trim() || body.note.length > 2000) throw new HttpError(400, 'invalid_review', 'Provide a publication decision, revision and review note.')
  const saved = await env.DB.prepare("SELECT d.* FROM creator_drafts d JOIN creators c ON c.id = d.creator_id WHERE d.id = ? AND c.status IN ('invited','active')").bind(id).first<Draft>()
  if (!saved || saved.status !== 'review' || saved.revision !== body.revision) throw conflict()
  const document = creatorDocument(JSON.parse(saved.document_json), true)
  await validateTags(env, document)
  const owner = await env.DB.prepare('SELECT * FROM creators WHERE id = ?').bind(saved.creator_id).first<Creator>()
  if (!owner) throw notFound()
  const now = new Date().toISOString(), claim = crypto.randomUUID(), version = saved.base_version + 1
  const guard = 'EXISTS (SELECT 1 FROM creator_drafts WHERE id = ? AND publication_claim = ?)'
  const statements = [env.DB.prepare(`UPDATE creator_drafts SET status = ?, review_note = ?, publication_claim = ?, updated_at = ?
    WHERE id = ? AND revision = ? AND status = 'review'
    AND EXISTS (SELECT 1 FROM creators WHERE id = creator_drafts.creator_id AND ${openCreator})
    AND EXISTS (SELECT 1 FROM skills WHERE id = creator_drafts.skill_id AND
      ((creator_drafts.base_version = 0 AND status = 'draft') OR (current_version = creator_drafts.base_version AND status = 'published')))`)
    .bind(body.decision, body.note.trim(), claim, now, id, saved.revision)]
  if (body.decision === 'published') {
    const nimPayment = document.priceNim === null ? null : creatorNimPrice(nimAtomic(document.priceNim), owner.nimiq_address)
    statements.push(env.DB.prepare(`INSERT INTO skill_versions (id, skill_id, version, manifest_json, review_status, published_at, access_kind, publication_json)
      SELECT ?, ?, ?, ?, 'approved', ?, ?, ? WHERE ${guard}`)
      .bind(crypto.randomUUID(), saved.skill_id, version, JSON.stringify(document), now, document.priceNim === null ? 'free' : 'paid',
        JSON.stringify({ title: document.title, summary: document.summary, creatorName: owner.display_name, nimPayment }), id, claim))
    statements.push(env.DB.prepare(`UPDATE skills SET slug = ?, title = ?, summary = ?, description = ?, category = ?, status = 'published', current_version = ?, updated_at = ?
      WHERE id = ? AND ${guard}`).bind(document.slug, document.title, document.summary, document.description, document.category, version, now, saved.skill_id, id, claim))
    statements.push(env.DB.prepare(`DELETE FROM skill_prices WHERE skill_id = ? AND ${guard}`).bind(saved.skill_id, id, claim))
    if (nimPayment) statements.push(env.DB.prepare(`INSERT INTO skill_prices (id,skill_id,asset,decimals,amount_atomic,recipient,active)
      SELECT ?, ?, 'NIM', 5, ?, ?, 1 WHERE ${guard}`).bind(crypto.randomUUID(), saved.skill_id, nimPayment.amountAtomic, nimPayment.recipient, id, claim))
    statements.push(env.DB.prepare(`DELETE FROM skill_tags WHERE skill_id = ? AND ${guard}`).bind(saved.skill_id, id, claim))
    for (const tag of document.tags) statements.push(env.DB.prepare(`INSERT INTO skill_tags (skill_id, tag_id) SELECT ?, id FROM tags WHERE slug = ? AND ${guard}`).bind(saved.skill_id, tag, id, claim))
    statements.push(env.DB.prepare(`UPDATE creators SET status = 'active', updated_at = ? WHERE id = ? AND ${guard}`).bind(now, owner.id, id, claim))
  }
  statements.push(env.DB.prepare(`INSERT INTO creator_reviews (id,draft_id,revision,decision,note,reviewer_wallet) SELECT ?, ?, ?, ?, ?, ? WHERE ${guard}`)
    .bind(claim, id, saved.revision, body.decision, body.note.trim(), reviewerWallet, id, claim))
  let results: D1Result[]
  try { results = await env.DB.batch(statements) } catch { throw new HttpError(409, 'publication_conflict', 'The Path link or version is already used. Nothing was published.') }
  if (results[0]?.meta.changes !== 1) throw conflict()
  return json({ status: body.decision, skillId: saved.skill_id, version: body.decision === 'published' ? version : null })
}
