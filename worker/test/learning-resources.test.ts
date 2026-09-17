import { describe, expect, it } from 'vitest'
import { parseLearningLink, parseLearningLinks, parseTaskWorkspaceUrl } from '../src/learning/resources'

describe('learning links', () => {
  it('accepts reviewed HTTPS links and local development HTTP links', () => {
    expect(parseLearningLink({ title: 'Nimiq docs', url: 'https://nimiq.dev/mini-apps/' })).toEqual({
      title: 'Nimiq docs', url: 'https://nimiq.dev/mini-apps/',
    })
    expect(parseTaskWorkspaceUrl('http://localhost:5173')).toMatchObject({ url: 'http://localhost:5173/' })
    expect(parseTaskWorkspaceUrl('http://[::1]:5173')).toMatchObject({ url: 'http://[::1]:5173/' })
  })

  it('rejects credentials, insecure remote links and oversized resource sets', () => {
    expect(() => parseLearningLink({ title: 'Unsafe', url: 'http://example.com' })).toThrow()
    expect(() => parseLearningLink({ title: 'Unsafe', url: 'https://user:secret@example.com' })).toThrow()
    expect(() => parseTaskWorkspaceUrl('javascript:alert(1)')).toThrow()
    expect(() => parseTaskWorkspaceUrl('file:///tmp/example')).toThrow()
    expect(() => parseLearningLinks(Array.from({ length: 9 }, (_, index) => ({ title: `Link ${index}`, url: 'https://example.com' })))).toThrow()
  })
})
