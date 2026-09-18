import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('creator profile save result is shown beside the save action', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  try {
    const { CreatorProfileEditor } = await vite.ssrLoadModule('/src/components/CreatorProfileEditor.tsx')
    const html = renderToStaticMarkup(createElement(CreatorProfileEditor, {
      profile: {
        slug: 'creator-test', displayName: 'Defi preacher', bio: 'This is me', avatarUrl: null,
        nimiqAddress: 'NQ47GFC8SCHC7R9901CJY7971EMH22532AG1', status: 'active',
      },
      busy: false,
      notice: { kind: 'success', text: 'Profile saved.' },
      onChange: () => undefined,
      onSave: () => undefined,
    }))
    assert.match(html, />Save changes</)
    assert.match(html, /class="profile-save-status"[^>]*>Profile saved\.<\/p>/)
    assert.ok(html.indexOf('Profile saved.') > html.indexOf('Save changes'))
  } finally {
    await vite.close()
  }
})
