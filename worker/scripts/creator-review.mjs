// Operator-only. Credentials are read from the environment / ignored .dev.vars, never printed.
import { readFileSync, writeFileSync, renameSync, chmodSync, lstatSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const configPath = fileURLToPath(new URL('../.dev.vars', import.meta.url))
function localConfig() {
  try { if (lstatSync(configPath).isSymbolicLink()) throw new Error('Do not use a symlink for .dev.vars.'); return readFileSync(configPath, 'utf8') }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error }
}
const localSecret = config => config.match(/^CREATOR_REVIEW_TOKEN\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^(['"])(.*)\1$/, '$2') ?? ''
const [command, id, revision, ...noteWords] = process.argv.slice(2)
try {
  if (command === 'setup-local') {
    const config = localConfig()
    if (localSecret(config)) console.log('Local reviewer key already configured. No change made.')
    else {
      const keyLine = `CREATOR_REVIEW_TOKEN=${randomBytes(32).toString('hex')}`
      const next = /^CREATOR_REVIEW_TOKEN\s*=/m.test(config) ? config.replace(/^CREATOR_REVIEW_TOKEN\s*=.*$/m, keyLine) : `${config.trimEnd()}\n${keyLine}\n`
      const temporary = `${configPath}.review-${randomBytes(8).toString('hex')}`
      writeFileSync(temporary, next, { flag: 'wx', mode: 0o600 }); renameSync(temporary, configPath); chmodSync(configPath, 0o600)
      console.log('Local reviewer key configured in ignored .dev.vars. Restart Core. No Path was published.')
    }
  } else if (command === 'setup-wallet') {
    const address = (id || '').replace(/\s/g, '').toUpperCase()
    if (!/^NQ\d{2}[0-9A-Z]{32}$/.test(address)) throw new Error('Give the public Nimiq reviewer address, not a key or recovery words.')
    const config = localConfig()
    const existing = config.match(/^REVIEWER_WALLETS\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^(['"])(.*)\1$/, '$2') ?? ''
    const accounts = [...new Set([...existing.split(',').map(value => value.trim()).filter(Boolean), address])]
    const line = `REVIEWER_WALLETS=${accounts.join(',')}`
    const next = /^REVIEWER_WALLETS\s*=/m.test(config) ? config.replace(/^REVIEWER_WALLETS\s*=.*$/m, line) : `${config.trimEnd()}\n${line}\n`
    const temporary = `${configPath}.review-${randomBytes(8).toString('hex')}`
    writeFileSync(temporary, next, { flag: 'wx', mode: 0o600 }); renameSync(temporary, configPath); chmodSync(configPath, 0o600)
    console.log(`Local reviewer authorized: ${address}. Restart Core. No Path was published.`)
  } else {
    if (!['list', 'show', 'publish', 'reject'].includes(command)) throw new Error('Usage: node scripts/creator-review.mjs setup-local | setup-wallet <public-NQ-address> | list | show <draft-id> | publish/reject <draft-id> <revision> <review-note>')
    const token = process.env.CREATOR_REVIEW_TOKEN || localSecret(localConfig())
    if (!token) throw new Error('Configure the operator key with setup-local or CREATOR_REVIEW_TOKEN.')
    const base = new URL(process.env.TRULY_REVIEW_CORE_URL || 'http://127.0.0.1:8787')
    if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new Error('Use HTTPS or local loopback for operator review.')
    const mutating = command === 'publish' || command === 'reject'
    if (mutating && (!/^[a-zA-Z0-9_-]{16,80}$/.test(id || '') || !/^\d+$/.test(revision || '') || !noteWords.join(' ').trim())) throw new Error('Give the exact draft ID, saved revision and review note.')
    const response = await fetch(new URL(mutating ? `/v1/studio/review/${id}` : '/v1/studio/review', base), {
      method: mutating ? 'POST' : 'GET', signal: AbortSignal.timeout(25000), headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(mutating ? { body: JSON.stringify({ revision: Number(revision), decision: command === 'publish' ? 'published' : 'rejected', note: noteWords.join(' ') }) } : {}) })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error?.message || `Review request failed (${response.status}).`)
    if (command === 'list') console.log(JSON.stringify(body.drafts.map(d => ({ id: d.id, title: d.document.title, revision: d.revision, version: d.baseVersion + 1 })), null, 2))
    else if (command === 'show') {
      const draft = body.drafts.find(d => d.id === id)
      if (!draft) throw new Error('That draft is not currently in review.')
      console.log(JSON.stringify(draft, null, 2))
    } else console.log(JSON.stringify(body, null, 2))
  }
} catch (error) { console.error(error.message); process.exitCode = 1 }
