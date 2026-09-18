import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCoreUrl } from '../src/core/core-url.ts'

test('production always uses the Mini App origin even when a local Core URL exists', () => {
  assert.equal(resolveCoreUrl({
    production: true,
    configuredUrl: 'http://192.168.18.3:8787',
    origin: 'https://app.usetruly.site',
  }), 'https://app.usetruly.site')
})

test('development can use a phone-reachable LAN Core URL', () => {
  assert.equal(resolveCoreUrl({
    production: false,
    configuredUrl: ' http://192.168.18.3:8787 ',
    origin: 'http://192.168.18.3:5173',
  }), 'http://192.168.18.3:8787')
  assert.equal(resolveCoreUrl({ production: false, origin: 'http://localhost:5173' }), '')
})
