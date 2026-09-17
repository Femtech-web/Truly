import { describe, expect, it } from 'vitest'
import { Hash, PrivateKey, PublicKey, Signature } from '@nimiq/core'
import { buildPairingMessage } from '../src/pairing'
import { nimiqAddressFromPublicKey, normalizePairingCode, verifyNimiqSignature } from '../src/security'

describe('pairing security', () => {
  it('normalizes codes without accepting separators as characters', () => {
    expect(normalizePairingCode('tr-uly 2')).toBe('TRULY2')
  })

  it('builds an explicit non-transaction pairing message', () => {
    const message = buildPairingMessage({
      deviceName: 'Femi’s MacBook Pro',
      origin: 'https://truly.example',
      nonce: 'nonce-123',
      expiresAt: '2026-09-16T15:00:00.000Z',
    })

    expect(message).toContain('Truly · Approve this Mac')
    expect(message).toContain('Femi’s MacBook Pro')
    expect(message).toContain('cannot send money')
  })

  it('derives exactly the same Nimiq address as the official core', () => {
    const privateKey = PrivateKey.generate()
    const publicKey = PublicKey.derive(privateKey)
    expect(nimiqAddressFromPublicKey(publicKey.serialize())).toBe(publicKey.toAddress().toUserFriendlyAddress())
  })

  it('accepts only a signature whose public key derives the claimed address', async () => {
    const privateKey = PrivateKey.generate()
    const publicKey = PublicKey.derive(privateKey)
    const message = 'Pair Femi’s Mac — 学習'
    const bytes = new TextEncoder().encode(message)
    const payload = new TextEncoder().encode(`\x16Nimiq Signed Message:\n${bytes.byteLength}${message}`)
    const signature = Signature.create(privateKey, publicKey, Hash.computeSha256(payload))

    await expect(verifyNimiqSignature({
      address: publicKey.toAddress().toUserFriendlyAddress(),
      publicKey: publicKey.toHex(),
      signature: signature.toHex(),
      message,
    })).resolves.toBe(true)

    await expect(verifyNimiqSignature({
      address: publicKey.toAddress().toUserFriendlyAddress(),
      publicKey: publicKey.toHex(),
      signature: signature.toHex(),
      message: `${message} modified`,
    })).resolves.toBe(false)

    await expect(verifyNimiqSignature({
      address: 'NQ00 0000 0000 0000 0000 0000 0000 0000 0000',
      publicKey: publicKey.toHex(),
      signature: signature.toHex(),
      message,
    })).resolves.toBe(false)

    const rawSignature = Signature.create(privateKey, publicKey, bytes)
    await expect(verifyNimiqSignature({
      address: publicKey.toAddress().toUserFriendlyAddress(),
      publicKey: publicKey.toHex(),
      signature: rawSignature.toHex(),
      message,
    })).resolves.toBe(false)
  })
})
