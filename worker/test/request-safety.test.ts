import { describe, expect, it } from 'vitest'
import { HttpError, readJson } from '../src/http'
import { verifyWalletChallenge } from '../src/device-management'
import type { Env } from '../src/types'

function post(body: string, contentType = 'application/json') {
  return new Request('https://core.truly.example/v1/auth/challenges', {
    method: 'POST', headers: { 'content-type': contentType }, body,
  })
}

describe('request safety', () => {
  it('accepts a bounded JSON object', async () => {
    await expect(readJson(post('{"ok":true}'))).resolves.toEqual({ ok: true })
  })
  it('rejects wrong media types', async () => {
    await expect(readJson(post('{}', 'text/plain'))).rejects.toMatchObject({ status: 415 })
  })
  it('rejects malformed JSON and non-object values', async () => {
    for (const value of ['{', 'null', '[]', '42']) {
      await expect(readJson(post(value))).rejects.toMatchObject({ status: 400 })
    }
  })
  it('bounds UTF-8 bytes rather than JavaScript characters', async () => {
    await expect(readJson(post(JSON.stringify({ text: '学'.repeat(6000) })))).rejects.toMatchObject({ status: 413 })
  })
  it('rejects expired wallet approvals before signature verification or session writes', async () => {
    const env = { DB: { prepare: () => ({ bind: () => ({ first: async () => ({
      wallet_address: 'NQ00', message: 'Expired approval', expires_at: '2000-01-01T00:00:00.000Z', consumed_at: null,
    }) }) }) } } as unknown as Env
    await expect(verifyWalletChallenge('expired', post(JSON.stringify({ publicKey: '00'.repeat(32), signature: '00'.repeat(64) })), env))
      .rejects.toMatchObject({ status: 410 })
  })
  it('retains explicit status/code on safety errors', () => {
    expect(new HttpError(429, 'rate_limited', 'Wait')).toMatchObject({ status: 429, code: 'rate_limited' })
  })
})
