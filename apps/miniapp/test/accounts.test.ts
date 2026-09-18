import test from 'node:test'
import assert from 'node:assert/strict'
import { availableAccounts, changeAccount } from '../src/wallet/accounts.ts'
const learner = 'NQ47GFC8SCHC7R9901CJY7971EMH22532AG1', seller = 'NQ1237R4KTF9AC69S6SMVMA5K0TAKYPCPB5G'
test('account discovery normalizes and deduplicates only exposed valid accounts without choosing one', () => {
  assert.deepEqual(availableAccounts(['bad', learner.toLowerCase(), 'NQ47 GFC8 SCHC 7R99 01CJ Y797 1EMH 2253 2AG1', seller]), [learner, seller])
})
test('switch ends the previous session before committing the new identity', async () => {
  const events: string[] = []
  await changeAccount({ selected: seller, available: [learner, seller], current: learner, endSession: async () => { events.push('logout') }, commit: account => { events.push(account) } })
  assert.deepEqual(events, ['logout', seller])
})
test('initial account selection does not depend on Core logout being reachable', async () => {
  let committed: string | null = null
  await changeAccount({
    selected: learner,
    available: [learner, seller],
    current: null,
    endSession: async () => { throw new Error('Truly could not connect. Check your connection and try again.') },
    commit: account => { committed = account },
  })
  assert.equal(committed, learner)
})
test('failed logout and an unexposed account never commit a switch', async () => {
  let committed = false
  const base = { selected: seller, available: [learner, seller], current: learner, endSession: async () => { throw new Error('Offline') }, commit: () => { committed = true } }
  await assert.rejects(changeAccount(base), /Offline/)
  await assert.rejects(changeAccount({ ...base, available: [learner] }), /Refresh accounts/)
  assert.equal(committed, false)
})
test('reselecting the current account does not clear its permissions', async () => {
  await changeAccount({ selected: learner, available: [learner], current: learner, endSession: async () => { assert.fail('Unexpected logout') }, commit: () => { assert.fail('Unexpected switch') } })
})
