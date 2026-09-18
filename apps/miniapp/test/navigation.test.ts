import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readNavigation, saveNavigation } from '../src/core/navigation.ts'

test('restores the learner page without persisting private data or wallet credentials', () => {
  let value = ''
  saveNavigation({ entered: true, tab: 'learn', learnView: 'tasks' }, { setItem: (_key, next) => { value = next } })
  assert.deepEqual(readNavigation({ getItem: () => value }), { entered: true, tab: 'learn', learnView: 'tasks' })
  assert.deepEqual(Object.keys(JSON.parse(value)).sort(), ['entered', 'learnView', 'tab'])
})
test('rejects malformed navigation, avoids an empty wallet page and resets on disconnect', () => {
  for (const value of ['{', 'null', JSON.stringify({ entered: false, tab: 'learn' })]) {
    assert.deepEqual(readNavigation({ getItem: () => value }), { entered: false, tab: 'home', learnView: 'tasks' })
  }
  assert.deepEqual(readNavigation({ getItem: () => JSON.stringify({ entered: true, tab: 'wallet', learnView: 'paths' }) }), { entered: true, tab: 'home', learnView: 'paths' })
  assert.doesNotThrow(() => saveNavigation({ entered: false, tab: 'home', learnView: 'tasks' }, { setItem: () => { throw new Error('private mode') } }))
})
