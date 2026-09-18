import { useCallback, useEffect, useRef, useState } from 'react'
import { CoreRequestError, coreRequest } from '../core/client'
import { resumeBrowserSession } from '../core/browser-session'
import { createIdempotencyKey } from '../core/idempotency'
import type { ActiveLearningSession, Device, LearningTask, Skill, WalletActivityOrder } from '../types'
import { getWalletError, wasRejected } from '../wallet/errors'

interface WalletGrant { account: string; token?: string; expiresAt: string; scopes: string[] }
function grantHeaders(current: WalletGrant): Record<string, string> {
  return current.token ? { authorization: `Bearer ${current.token}` } : { 'x-truly-account': current.account }
}

export function useDevices(account: string | null, signMessage: (message: string) => Promise<{ publicKey: string; signature: string }>) {
  const grant = useRef<WalletGrant | null>(null)
  const lock = useRef(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [owner, setOwner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [learningMessage, setLearningMessage] = useState('')
  const [activeLearning, setActiveLearning] = useState<ActiveLearningSession | null>(null)
  const [learningSessions, setLearningSessions] = useState<ActiveLearningSession[]>([])
  const [tasks, setTasks] = useState<LearningTask[]>([])
  const [ownedPathIds, setOwnedPathIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const accountRef = useRef(account)
  const operationRef = useRef(0)
  accountRef.current = account

  useEffect(() => {
    operationRef.current += 1
    lock.current = false
    grant.current = null
    setDevices([])
    setOwner(null)
    setReady(false)
    setBusy(false)
    setMessage('')
    setLearningMessage('')
    setActiveLearning(null)
    setLearningSessions([])
    setTasks([])
    setOwnedPathIds([])
    if (!account) { setRestoring(false); return }
    const address = account
    const operation = operationRef.current
    let cancelled = false
    setRestoring(true)
    void resumeBrowserSession().then(async session => {
      if (cancelled || !isCurrent(address, operation) || session?.account !== address) return
      grant.current = { account: address, expiresAt: session.expiresAt, scopes: session.scopes }
      await loadAccess(grant.current, operation)
    }).catch(error => {
      if (!cancelled && isCurrent(address, operation)) setLearningMessage(error instanceof Error ? error.message : 'Could not load your Tasks. Try again.')
    }).finally(() => {
      if (!cancelled && isCurrent(address, operation)) setRestoring(false)
    })
    return () => { cancelled = true }
  }, [account])

  function isCurrent(address: string, operation: number) {
    return accountRef.current === address && operationRef.current === operation
  }

  async function ensureGrant(address: string, operation: number, scope?: string): Promise<WalletGrant> {
    let current = grant.current
    if (current && current.account === address && Date.parse(current.expiresAt) > Date.now() && (!scope || current.scopes.includes(scope))) return current

    const saved = await resumeBrowserSession().catch(() => null)
    if (!isCurrent(address, operation)) throw new Error('The connected wallet changed. Start again.')
    if (saved?.account === address && (!scope || saved.scopes.includes(scope))) {
      current = { account: address, expiresAt: saved.expiresAt, scopes: saved.scopes }
      grant.current = current
      return current
    }

    const challenge = await coreRequest<{ challengeId: string; message: string }>('/v1/auth/challenges', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }),
    })
    if (!isCurrent(address, operation)) throw new Error('The connected wallet changed. Start again.')
    const signature = await signMessage(challenge.message)
    if (!isCurrent(address, operation)) throw new Error('The connected wallet changed. Start again.')
    const result = await coreRequest<{ token: string; expiresAt: string; scopes: string[] }>(`/v1/auth/challenges/${challenge.challengeId}/verify`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(signature),
    })
    if (!isCurrent(address, operation)) throw new Error('The connected wallet changed. Start again.')
    current = { account: address, ...result }
    grant.current = current
    return current
  }

  async function loadAccess(current: WalletGrant, operation: number) {
    const headers = grantHeaders(current)
    const purchaseAccess = current.scopes.includes('purchases:read')
      ? coreRequest<{ entitlements: Array<{ pathId: string }> }>('/v1/purchases', { headers })
      : Promise.resolve({ entitlements: [] })
    const [deviceResult, learningResult, taskResult, purchaseResult] = await Promise.all([
      coreRequest<{ devices: Device[] }>('/v1/devices', { headers }),
      coreRequest<{ sessions: ActiveLearningSession[] }>('/v1/learning/sessions', { headers }),
      coreRequest<{ tasks: LearningTask[] }>('/v1/tasks', { headers }),
      purchaseAccess,
    ])
    if (!isCurrent(current.account, operation)) return []
    setDevices(deviceResult.devices)
    setOwner(current.account)
    setReady(true)
    setActiveLearning(learningResult.sessions.find((session) => session.status === 'active') ?? null)
    setLearningSessions(learningResult.sessions)
    setTasks(taskResult.tasks)
    setOwnedPathIds(Array.from(new Set([
      ...purchaseResult.entitlements.map(entitlement => entitlement.pathId),
      ...taskResult.tasks.flatMap(task => task.source.kind === 'path' && task.source.pathId ? [task.source.pathId] : []),
    ])))
    return deviceResult.devices
  }

  const refresh = useCallback(async () => {
    const current = grant.current
    if (!current || current.account !== account || lock.current || restoring) return
    if (Date.parse(current.expiresAt) <= Date.now()) {
      grant.current = null
      setReady(false)
      setMessage('Your sign-in expired. Approve access again to continue.')
      setLearningMessage('Your sign-in expired. Your saved Tasks are safe; approve access to continue.')
      return
    }
    const operation = ++operationRef.current
    lock.current = true
    setBusy(true)
    try {
      await loadAccess(current, operation)
      if (isCurrent(current.account, operation)) setMessage('')
    } catch (error) {
      if (!isCurrent(current.account, operation)) return
      if (error instanceof CoreRequestError && (error.status === 401 || error.status === 403)) {
        grant.current = null
        setReady(false)
      }
      setMessage(error instanceof Error ? error.message : 'Could not refresh your Macs. Try again.')
    } finally {
      if (operationRef.current === operation) { lock.current = false; setBusy(false) }
    }
  }, [account, restoring])

  const loadWalletActivity = useCallback(async (): Promise<WalletActivityOrder[]> => {
    const current = grant.current
    if (!account || !current || current.account !== account || Date.parse(current.expiresAt) <= Date.now()) {
      throw new Error('Approve Truly access to load your payment activity.')
    }
    const result = await coreRequest<{ orders: WalletActivityOrder[] }>('/v1/purchases', { headers: grantHeaders(current) })
    return result.orders.filter(order => order.status === 'submitted' || order.status === 'validated')
  }, [account])

  async function approveAccess(purpose: 'devices' | 'learning', scope?: string): Promise<Device[]> {
    if (!account || lock.current || restoring) return []
    const operation = ++operationRef.current
    const address = account
    lock.current = true
    setBusy(true)
    if (purpose === 'devices') setMessage('')
    else setLearningMessage('')
    try {
      const current = await ensureGrant(address, operation, scope)
      const result = await loadAccess(current, operation)
      if (isCurrent(address, operation)) {
        setMessage('')
        setLearningMessage('')
      }
      return result
    } catch (error) {
      if (!isCurrent(address, operation)) return []
      grant.current = null
      setReady(false)
      const copy = wasRejected(error)
        ? 'Approval cancelled. Nothing changed.'
        : getWalletError(error)
      if (purpose === 'devices') setMessage(copy)
      else setLearningMessage(copy)
      return []
    } finally {
      if (operationRef.current === operation) { lock.current = false; setBusy(false) }
    }
  }

  // Reuse a live grant; polling must never open a wallet dialog.
  useEffect(() => {
    if (!ready || owner !== account) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 5000)
    const visible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [ready, owner, account, refresh])

  async function manage() { await approveAccess('devices') }
  async function prepareLearning(): Promise<Device[]> { return approveAccess('learning') }
  async function preparePurchase(): Promise<boolean> {
    await approveAccess('learning', 'purchases:write')
    return Boolean(grant.current?.scopes.includes('purchases:write'))
  }
  function purchaseHeaders(): Record<string, string> {
    const current = grant.current
    if (!account || !current || current.account !== account || Date.parse(current.expiresAt) <= Date.now()) throw new Error('Approve access again before checking this purchase.')
    return grantHeaders(current)
  }
  function clearLearningMessage() { setLearningMessage('') }
  function markPathOwned(pathId: string) {
    setOwnedPathIds(items => items.includes(pathId) ? items : [...items, pathId])
  }

  async function activateSkill(skill: Skill, deviceId: string): Promise<ActiveLearningSession | null> {
    const current = grant.current
    if (!account || !current || current.account !== account || lock.current) {
      setLearningMessage('Approve access before choosing a Mac.')
      return null
    }
    const operation = ++operationRef.current
    const address = account
    lock.current = true
    setBusy(true)
    setLearningMessage('')
    try {
      const result = await coreRequest<{ session: ActiveLearningSession; resumed: boolean }>('/v1/learning/sessions/activate', {
        method: 'POST',
        headers: {
          ...grantHeaders(current),
          'content-type': 'application/json',
          'idempotency-key': createIdempotencyKey(),
        },
        body: JSON.stringify({ deviceId, skillId: skill.id, skillVersion: skill.version }),
      })
      if (!isCurrent(address, operation)) return null
      setActiveLearning(result.session)
      try {
        const library = await coreRequest<{ tasks: LearningTask[] }>('/v1/tasks', {
          headers: grantHeaders(current),
        })
        if (isCurrent(address, operation)) setTasks(library.tasks)
      } catch {
        // Activation already succeeded. Keep the handoff usable if library refresh fails.
      }
      if (!isCurrent(address, operation)) return null
      setLearningMessage(result.resumed
        ? `${skill.title} is ready to continue on ${result.session.device.name}.`
        : `${skill.title} is ready on ${result.session.device.name}.`)
      return result.session
    } catch (error) {
      if (!isCurrent(address, operation)) return null
      const copy = error instanceof Error ? error.message : 'Could not start this Path. Try again.'
      setLearningMessage(copy)
      if (/expired|approve/i.test(copy)) { grant.current = null; setReady(false) }
      return null
    } finally {
      if (operationRef.current === operation) { lock.current = false; setBusy(false) }
    }
  }

  async function createTask(input: { goal: string; workspaceUrl?: string; resources?: Array<{ title: string; url: string }> }): Promise<LearningTask | null> {
    if (lock.current) return null
    await approveAccess('learning')
    const current = grant.current
    if (!account || !current || current.account !== account) return null
    const operation = ++operationRef.current
    const address = account
    lock.current = true
    setBusy(true)
    setLearningMessage('')
    try {
      const result = await coreRequest<{ task: LearningTask }>('/v1/tasks', {
        method: 'POST', headers: { ...grantHeaders(current), 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!isCurrent(address, operation)) return null
      setTasks((items) => [result.task, ...items.filter((item) => item.id !== result.task.id)])
      return result.task
    } catch (error) {
      if (isCurrent(address, operation)) setLearningMessage(error instanceof Error ? error.message : 'Could not prepare that Task. Try again.')
      return null
    } finally {
      if (operationRef.current === operation) { lock.current = false; setBusy(false) }
    }
  }

  async function activateTask(task: LearningTask, deviceId: string): Promise<ActiveLearningSession | null> {
    const current = grant.current
    if (!account || !current || current.account !== account || lock.current) return null
    const operation = ++operationRef.current
    const address = account
    lock.current = true
    setBusy(true)
    setLearningMessage('')
    try {
      const result = await coreRequest<{ session: ActiveLearningSession; resumed: boolean }>(`/v1/tasks/${encodeURIComponent(task.id)}/activate`, {
        method: 'POST', headers: { ...grantHeaders(current), 'content-type': 'application/json', 'idempotency-key': createIdempotencyKey() },
        body: JSON.stringify({ deviceId }),
      })
      if (!isCurrent(address, operation)) return null
      setActiveLearning(result.session)
      setLearningMessage(`${task.title} is ready on ${result.session.device.name}.`)
      return result.session
    } catch (error) {
      if (isCurrent(address, operation)) setLearningMessage(error instanceof Error ? error.message : 'Could not start this Task. Try again.')
      return null
    } finally {
      if (operationRef.current === operation) { lock.current = false; setBusy(false) }
    }
  }

  async function updateTaskPlan(task: LearningTask, plan: Pick<LearningTask, 'title' | 'outcome' | 'steps'>): Promise<LearningTask | null> {
    if (lock.current || restoring) return null
    await approveAccess('learning', 'tasks:edit')
    const current = grant.current
    if (!account || !current || current.account !== account) return null
    const operation = ++operationRef.current
    const address = account
    lock.current = true
    setBusy(true)
    setLearningMessage('')
    try {
      const result = await coreRequest<{ task: LearningTask }>(`/v1/tasks/${encodeURIComponent(task.id)}/plan`, {
        method: 'POST', headers: { ...grantHeaders(current), 'content-type': 'application/json' },
        body: JSON.stringify({ plan, updatedAt: task.updatedAt }),
      })
      if (!isCurrent(address, operation)) return null
      setTasks(items => items.map(item => item.id === task.id ? result.task : item))
      return result.task
    } catch (error) {
      if (isCurrent(address, operation)) setLearningMessage(error instanceof Error ? error.message : 'Could not save your plan. Try again.')
      return null
    } finally {
      if (operationRef.current === operation) { lock.current = false; setBusy(false) }
    }
  }

  async function revoke(id: string) {
    const current = grant.current
    if (!account || !current || current.account !== account || lock.current) return
    const operation = ++operationRef.current
    const address = account
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      await coreRequest(`/v1/devices/${encodeURIComponent(id)}/revoke`, {
        method: 'POST', headers: grantHeaders(current),
      })
      if (!isCurrent(address, operation)) return
      setDevices((items) => items.map((item) => item.id === id ? { ...item, status: 'revoked' } : item))
      if (activeLearning?.device.id === id) setActiveLearning(null)
      setMessage('Mac removed. Pair it again whenever you want to reconnect.')
    } catch (error) {
      if (!isCurrent(address, operation)) return
      grant.current = null
      setReady(false)
      setMessage(error instanceof Error ? error.message : 'Could not remove this Mac. Refresh and try again.')
    } finally {
      if (operationRef.current === operation) { lock.current = false; setBusy(false) }
    }
  }

  return {
    devices: owner === account ? devices : [],
    ready: ready && owner === account,
    busy: busy || restoring,
    restoring,
    message,
    learningMessage,
    activeLearning: owner === account ? activeLearning : null,
    learningSessions: owner === account ? learningSessions : [],
    tasks: owner === account ? tasks : [],
    ownedPathIds: owner === account ? ownedPathIds : [],
    manage,
    revoke,
    refresh,
    prepareLearning,
    preparePurchase,
    purchaseHeaders,
    clearLearningMessage,
    markPathOwned,
    activateSkill,
    createTask,
    activateTask,
    updateTaskPlan,
    loadWalletActivity,
  }
}
