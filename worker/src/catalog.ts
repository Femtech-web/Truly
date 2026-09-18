import { json } from './http'
import type { Env } from './types'
import { parseManifest } from './learning/access'
import { approvedNimPrice, paymentConfiguration } from './payments/config'
import { POLYGON_USDT } from './payments/config'
import { normalizeNimiqAddress } from './security'

interface SkillRow {
  id: string
  slug: string
  title: string
  summary: string
  description: string
  category: string
  current_version: number
  creator_slug: string
  creator_name: string
  creator_bio: string
  creator_status: string
  nimiq_address: string
  evm_address: string | null
  manifest_json: string
  review_status: string
  access_kind: string
  publication_json: string
}

export async function getCatalog(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT skills.id, skills.slug, skills.title, skills.summary, skills.description,
            skills.category, skills.current_version, creators.slug AS creator_slug,
            creators.display_name AS creator_name, creators.bio AS creator_bio,
            creators.status AS creator_status, creators.nimiq_address, creators.evm_address,
            skill_versions.manifest_json, skill_versions.review_status, skill_versions.access_kind, skill_versions.publication_json
     FROM skills
     JOIN creators ON creators.id = skills.creator_id
     JOIN skill_versions ON skill_versions.skill_id = skills.id
       AND skill_versions.version = skills.current_version
     WHERE skills.status = 'published' AND skill_versions.review_status = 'approved'
       AND creators.status IN ('invited', 'active')
     ORDER BY skills.created_at ASC`,
  ).all<SkillRow>()

  const skills = await Promise.all(results.map(async (skill) => {
    const manifest = parseManifest(skill.manifest_json)
    const [tags, prices] = await Promise.all([
      env.DB.prepare(
        `SELECT tags.slug, tags.label, tags.family FROM tags
         JOIN skill_tags ON skill_tags.tag_id = tags.id
         WHERE skill_tags.skill_id = ? ORDER BY tags.family, tags.label`,
      ).bind(skill.id).all(),
      env.DB.prepare(
        `SELECT asset, chain_id AS chainId, token_address AS tokenAddress,
                decimals, amount_atomic AS amountAtomic, recipient, active
         FROM skill_prices WHERE skill_id = ? ORDER BY asset`,
      ).bind(skill.id).all(),
    ])

    return {
      id: skill.id,
      slug: skill.slug,
      title: skill.title,
      summary: skill.summary,
      description: skill.description,
      category: skill.category,
      currentVersion: skill.current_version,
      creator: {
        slug: skill.creator_slug,
        displayName: skill.creator_name,
        bio: skill.creator_bio,
      },
      tags: tags.results,
      prices: prices.results.map(price => {
        const item = price as { asset: 'NIM' | 'USDT'; active: number; recipient: string; amountAtomic: string; decimals: number; chainId: string | null; tokenAddress: string | null }
        let checkoutEnabled = false
        try {
          const configuration = paymentConfiguration(env, item.asset)
          const recipient = item.asset === 'NIM' ? normalizeNimiqAddress(item.recipient) : item.recipient.toLowerCase()
          const creatorRecipient = item.asset === 'NIM' ? normalizeNimiqAddress(skill.nimiq_address) : skill.evm_address?.toLowerCase()
          const approvedRecipient = item.asset === 'NIM'
            ? approvedNimPrice(skill.publication_json, skill.nimiq_address, item).recipient : configuration.recipient
          checkoutEnabled = skill.access_kind === 'paid' && item.active === 1 && skill.creator_status === 'active' && recipient === approvedRecipient &&
            recipient === creatorRecipient && (item.asset === 'NIM' || (item.chainId === '0x89' && item.tokenAddress?.toLowerCase() === POLYGON_USDT))
        }
        catch { /* Unconfigured payment options remain honest previews. */ }
        return { ...price, checkoutEnabled }
      }),
      outcomes: manifest.outcomes,
      prerequisites: manifest.prerequisites,
      supportedEnvironments: manifest.supportedEnvironments,
      estimatedMinutes: manifest.estimatedMinutes,
      // Discovery is not an entitlement. Paid content uses the access-checked Task/runtime.
      steps: skill.access_kind === 'paid' ? manifest.steps.map(step => ({
        id: step.id, title: step.title, summary: '', workspaceLink: null,
        resources: [], challenge: null, rubric: [],
      })) : manifest.steps,
      runtimeReady: skill.review_status === 'approved' && manifest.steps.length > 0,
    }
  }))

  return json({ skills })
}

export async function getCreator(slug: string, env: Env): Promise<Response> {
  const creator = await env.DB.prepare(
    `SELECT id, slug, display_name AS displayName, bio, avatar_url AS avatarUrl
     FROM creators WHERE slug = ? AND status IN ('invited', 'active') LIMIT 1`,
  ).bind(slug).first<Record<string, unknown> & { id: string }>()

  if (!creator) return json({ error: { code: 'creator_not_found', message: 'That creator was not found.' } }, { status: 404 })
  const { results: skills } = await env.DB.prepare(
    `SELECT s.id, s.slug, s.title, s.summary, s.category, s.current_version AS currentVersion
     FROM skills s JOIN skill_versions v ON v.skill_id = s.id AND v.version = s.current_version
     WHERE s.creator_id = ? AND s.status = 'published' AND v.review_status = 'approved' ORDER BY s.created_at DESC`,
  ).bind(creator.id).all()

  const { id: _id, ...profile } = creator
  return json({ creator: profile, skills })
}
