import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('production AI configuration', () => {
  it('keeps AI turns enabled after Groq Zero Data Retention is confirmed', () => {
    const configuration = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
    expect(configuration).toMatch(/^GROQ_DATA_CONTROLS_CONFIRMED\s*=\s*"true"\s*$/m)
  })
})
