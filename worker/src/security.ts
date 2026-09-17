import { verifyAsync } from '@noble/ed25519'
import { blake2b } from '@noble/hashes/blake2.js'

const encoder = new TextEncoder()
const pairAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const nimiqAlphabet = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

export function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return toBase64Url(bytes)
}

export function randomPairingCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (value) => pairAlphabet[value % pairAlphabet.length]).join('')
}

export function normalizePairingCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length)
  let difference = left.length ^ right.length
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return difference === 0
}

export async function verifyNimiqSignature(input: {
  address: string
  publicKey: string
  signature: string
  message: string
}): Promise<boolean> {
  try {
    const publicKey = fromHex(input.publicKey)
    const signature = fromHex(input.signature)
    const derivedAddress = nimiqAddressFromPublicKey(publicKey)

    if (normalizeNimiqAddress(derivedAddress) !== normalizeNimiqAddress(input.address)) return false
    return await verifyAsync(signature, await nimiqSignedMessageHash(input.message), publicKey, { zip215: false })
  } catch {
    return false
  }
}

export function normalizeNimiqAddress(value: string): string {
  return value.toUpperCase().replace(/\s/g, '')
}

export async function nimiqSignedMessageHash(message: string): Promise<Uint8Array> {
  // Nimiq Keyguard's SIGNED_MESSAGE convention: prefix + UTF-8 byte length + message, then SHA-256.
  // https://github.com/nimiq/keyguard/blob/master/src/lib/Key.js
  // https://github.com/nimiq/keyguard/blob/master/client/src/SignMessagePrefix.ts
  const bytes = encoder.encode(message)
  const prefix = encoder.encode(`\x16Nimiq Signed Message:\n${bytes.byteLength}`)
  const payload = new Uint8Array(prefix.byteLength + bytes.byteLength)
  payload.set(prefix)
  payload.set(bytes, prefix.byteLength)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', payload))
}

export function nimiqAddressFromPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error('A Nimiq public key must contain 32 bytes.')
  const addressBytes = blake2b(publicKey, { dkLen: 32 }).slice(0, 20)
  const body = toNimiqBase32(addressBytes)
  const checksum = String(98 - ibanMod97(toIbanDigits(`${body}NQ00`))).padStart(2, '0')
  return `NQ${checksum}${body}`.replace(/(.{4})(?=.)/g, '$1 ')
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromHex(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[a-fA-F0-9]+$/.test(value)) throw new Error('Invalid hexadecimal value.')
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
}

function toNimiqBase32(bytes: Uint8Array): string {
  let output = ''
  let value = 0
  let bitCount = 0

  for (const byte of bytes) {
    value = (value << 8) | byte
    bitCount += 8
    while (bitCount >= 5) {
      output += nimiqAlphabet[(value >>> (bitCount - 5)) & 31]
      bitCount -= 5
    }
  }

  if (bitCount > 0) output += nimiqAlphabet[(value << (5 - bitCount)) & 31]
  return output
}

function toIbanDigits(value: string): string {
  return Array.from(value, (character) => {
    const code = character.toUpperCase().charCodeAt(0)
    return code >= 48 && code <= 57 ? character : String(code - 55)
  }).join('')
}

function ibanMod97(value: string): number {
  let remainder = ''
  for (let offset = 0; offset < value.length; offset += 6) {
    remainder = String(Number.parseInt(remainder + value.slice(offset, offset + 6), 10) % 97)
  }
  return Number.parseInt(remainder, 10)
}
