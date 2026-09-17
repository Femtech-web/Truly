import { useCallback, useEffect, useRef, useState } from 'react'
import { coreRequest } from '../core/client'
import { createIdempotencyKey } from '../core/idempotency'
import type { ActiveLearningSession, Device, LearningTask, Skill } from '../types'
import { getWalletError, wasRejected } from '../wallet/errors'

interface WalletGrant { account: string; token: string; expiresAt: string }

export function useDevices(account: string | null, signMessage: (message: string) => Promise<{ publicKey: string; signature: string }>) {
  const grant = useRef<WalletGrant | null>(null)
  const lock = useRef(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [owner, setOwner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [learningMessage, setLearningMessage] = useState('')
  const [activeLearning, setActiveLearning] = useState<ActiveLearningSession | null>(null)
  const [tasks, setTasks] = useState<LearningTask[]>([])
  const [ready, setReady] = useState(false)
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
    setTasks([])
  }, [account])

  function isCurrent(address: string, operation: number) {
    return accountRef.current === address && operationRef.current === operation
  }

  async function ensureGrant(address: string, operation: number): Promise<WalletGrant> {
    let current = grant.current
    if (current && current.account === address && Date.parse(current.expiresAt) > Date.now()) return current

    const challenge = await coreRequest<{ challengeId: string; message: string }>('/v1/auth/challenges', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }),
    })
    if (!isCurrent(address, operation)) throw new Error('The connected wallet changed. Start again.')
    const signature = await signMessage(challenge.message)
    if (!isCurrent(address, operation)) throw new Error('The connected wallet changed. Start again.')
    const result = await coreRequest<{ token: string; expiresAt: string }>(`/v1/auth/challenges/${challenge.challengeId}/verify`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(signature),
    })
    if (!isCurrent(address, operation)) throw new Error('The connected wallet changed. Start again.')
    current = { account: address, ...result }
    grant.current = current
    return current
  }

  async function loadAccess(current: WalletGrant, operation: number) {
    const headers = { authorization: `Bearer ${current.token}` }
    const [deviceResult, learningResult, taskResult] = await Promise.all([
      coreRequest<{ devices: Device[] }>('/v1/devices', { headers }),
      coreRequest<{ sessions: ActiveLearningSession[] }>('/v1/learning/sessions', { headers }),
      coreRequest<{ tasks: LearningTask[] }>('/v1/tasks', { headers }),
    ])
    if (!isCurrent(current.account, operation)) return []
    setDevices(deviceResult.devices)
    setOwner(current.account)
    setReady(true)
    setActiveLearning(learningResult.sessions.find((session) => session.status === 'active') ?? null)
    setTasks(taskResult.tasks)
    return deviceResult.devices
  }

  const refresh = useCallback(async () => {
    const current = grant.current
    if (!current || current.account !== account || lock.current) return
    if (Date.parse(current.expiresAt) <= Date.now()) {
      grant.current = null
      setReady(false)
      setMessage('Your approval expired. Approve again to refresh your Macs.')
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
      grant.current = null
      setReady(false)
      setMessage(error instanceof Error ? error.message : 'Could not refresh your Macs. Try again.')
    } finally {
      if (operationRef.current === operation) { lock.current = false; setBusy(false) }
    }
  }, [account])

  async function approveAccess(purpose: 'devices' | 'learning'): Promise<Device[]> {
    if (!account || lock.current) return []
    const operation = ++operationRef.current
    const address = account
    lock.current = true
    setBusy(true)
    if (purpose === 'devices') setMessage('')
    else setLearningMessage('')
    try {
      const current = await ensureGrant(address, operation)
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

  async function manage() { await approveAccess('devices') }
  async function prepareLearning(): Promise<Device[]> { return approveAccess('learning') }
  function clearLearningMessage() { setLearningMessage('') }

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
          authorization: `Bearer ${current.token}`,
          'content-type': 'application/json',
          'idempotency-key': createIdempotencyKey(),
        },
        body: JSON.stringify({ deviceId, skillId: skill.id, skillVersion: skill.version }),
      })
      if (!isCurrent(address, operation)) return null
      setActiveLearning(result.session)
      try {
        const library = await coreRequest<{ tasks: LearningTask[] }>('/v1/tasks', {
          headers: { authorization: `Bearer ${current.token}` },
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
        method: 'POST', headers: { authorization: `Bearer ${current.token}`, 'content-type': 'application/json' },
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
        method: 'POST', headers: { authorization: `Bearer ${current.token}`, 'content-type': 'application/json', 'idempotency-key': createIdempotencyKey() },
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
        method: 'POST', headers: { authorization: `Bearer ${current.token}` },
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
    busy,
    message,
    learningMessage,
    activeLearning,
    tasks: owner === account ? tasks : [],
    manage,
    revoke,
    refresh,
    prepareLearning,
    clearLearningMessage,
    activateSkill,
    createTask,
    activateTask,
  }
}
