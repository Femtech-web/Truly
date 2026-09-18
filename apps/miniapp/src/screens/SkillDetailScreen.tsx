import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Circle, Clock3, ExternalLink, Laptop, Link2, Monitor } from 'lucide-react'
import type { useDevices } from '../hooks/useDevices'
import type { Skill } from '../types'
import { PurchasePanel } from '../components/PurchasePanel'
import { handoffActionCopy } from '../core/handoff-presentation'

interface SkillDetailScreenProps {
  skill: Skill
  devices: ReturnType<typeof useDevices>
  account: string | null
  walletKind: 'nimiq' | null
  onBack: () => void
  onConnect: () => void
  onShowDevices: () => void
  onOpenCreator: () => void
  payNim(input: { recipient: string; value: number; reference: string }): Promise<string>
}

export function SkillDetailScreen({
  skill, devices, account, walletKind, onBack, onConnect, onShowDevices, payNim, onOpenCreator,
}: SkillDetailScreenProps) {
  const [choosingMac, setChoosingMac] = useState(false)
  const [purchaseUnlocked, setPurchaseUnlocked] = useState(false)
  const [deliveredDeviceName, setDeliveredDeviceName] = useState<string | null>(null)
  const isPaid = skill.prices.length > 0
  const firstStep = skill.lessons[0]
  const activeSession = devices.activeLearning?.source.kind === 'path' && devices.activeLearning.source.id === skill.id ? devices.activeLearning : null
  const saved = devices.learningSessions.find(session => session.source.kind === 'path' && session.source.id === skill.id && session.source.version === skill.version)
  const owned = devices.ownedPathIds.includes(skill.id)

  useEffect(() => { setChoosingMac(false); setPurchaseUnlocked(owned || Boolean(saved)); setDeliveredDeviceName(null) }, [skill.id])
  useEffect(() => { if (saved || owned) setPurchaseUnlocked(true) }, [saved, owned])

  function unlockPath() {
    devices.markPathOwned(skill.id)
    setPurchaseUnlocked(true)
  }

  async function beginMacChoice() {
    const available = await devices.prepareLearning()
    if (available.some((device) => device.status === 'active')) setChoosingMac(true)
  }

  async function activate(deviceId: string) {
    const session = await devices.activateSkill(skill, deviceId)
    if (session) {
      setChoosingMac(false)
      setDeliveredDeviceName(session.device.name)
    }
  }

  return (
    <main className="screen detail-screen page-enter">
      <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={18} /> Back to Paths</button>

      <section className={`detail-hero detail-hero--${skill.theme}`}>
        <span className="eyebrow">{skill.eyebrow}</span>
        <h1>{skill.title}</h1>
        <p>{skill.description}</p>
        <div className="detail-hero__meta">
          <button className="text-button" type="button" onClick={onOpenCreator}>By {skill.creator.displayName}</button>
          <span>{isPaid ? `${skill.price} NIM` : 'Free'}</span>
        </div>
      </section>

      <div className="skill-tag-list" aria-label="Path tags">
        {skill.tags.map((tag) => <span key={tag.slug}>{tag.label}</span>)}
      </div>

      <section className="outcome-card">
        <h2>What you’ll be able to do</h2>
        <ul>{skill.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
      </section>

      <section className="skill-facts" aria-label="Path requirements">
        <div><Clock3 size={17} /><span><strong>{skill.lessons.length} steps</strong><small>{skill.estimatedMinutes ? `About ${skill.estimatedMinutes} minutes` : 'Learn at your pace'}</small></span></div>
        <div><Monitor size={17} /><span><strong>Works with</strong><small>{skill.supportedEnvironments.join(', ')}</small></span></div>
      </section>

      {skill.prerequisites.length > 0 && <section className="prerequisite-section">
        <h2>What you’ll need</h2>
        <ul>{skill.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>}

      {skill.lessons.length > 0 && <section className="lesson-section">
        <div className="section-heading"><h2>Your learning path</h2><span>{skill.lessons.length} steps</span></div>
        <ol className="lesson-list">
          {skill.lessons.map((lesson, index) => {
            const complete = saved?.progress?.completedStepIds.includes(lesson.id) ?? false
            const state = complete ? 'complete' : (activeSession?.currentStep.id === lesson.id ? 'current' : 'next')
            return <li className={`lesson lesson--${state}`} key={lesson.id}>
              <span className="lesson__marker">
                {complete ? <Check size={14} /> : <Circle size={8} fill="currentColor" />}
              </span>
              <span><small>Step {index + 1}</small><strong>{lesson.title}</strong><p>{lesson.detail}</p>{(lesson.workspaceLink || lesson.resources.length > 0) && <em><Link2 size={11} /> {lesson.resources.length + (lesson.workspaceLink ? 1 : 0)} link{lesson.resources.length + (lesson.workspaceLink ? 1 : 0) === 1 ? '' : 's'}</em>}</span>
            </li>
          })}
        </ol>
      </section>}

      {firstStep?.workspaceLink && <section className="path-starting-point"><span><ExternalLink size={17} /></span><div><h2>Starting point</h2><p>{firstStep.workspaceLink.title}</p><small>{new URL(firstStep.workspaceLink.url).hostname}</small></div><p>Your Mac will ask before opening this destination.</p></section>}

      {!skill.runtimeReady && <div className="quiet-card"><h2>Coming to Mac soon</h2><p>We’re still preparing the guided practice for this Path.</p></div>}

      {saved?.status === 'completed' ? <section className="quiet-card"><h2>Path complete</h2><p>Your AI-checked steps are saved in Progress.</p></section> : isPaid && !purchaseUnlocked && account ? (
        <PurchasePanel skill={skill} account={account} devices={devices} payNim={payNim} onUnlocked={unlockPath} />
      ) : isPaid && !purchaseUnlocked ? (
        <button className="primary-button sticky-action" type="button" disabled={walletKind !== 'nimiq'} onClick={onConnect}>Connect Nimiq wallet <ArrowRight size={17} /></button>
      ) : activeSession && !choosingMac ? (
        <section className="activation-success" role="status">
          <span><Check size={17} /></span>
          <div>
            <h2>Ready on {activeSession.device.name}</h2>
            <p>Step {activeSession.currentStep.index} of {activeSession.currentStep.total}: {activeSession.currentStep.title}</p>
            <small>Truly will confirm the handoff on your Mac. If the companion is hidden, show it from the menu bar when you are ready.</small>
          </div>
          <div className="activation-success__actions">
            {deliveredDeviceName
              ? <div className="handoff-delivered"><Check size={16} /> {handoffActionCopy({ busy: false, deliveredDeviceName })}</div>
              : <button className="primary-button" type="button" disabled={devices.busy} onClick={() => { void activate(activeSession.device.id) }}>
                {handoffActionCopy({ busy: devices.busy, deliveredDeviceName: null })} <ArrowRight size={16} />
              </button>}
            <button className="secondary-button" type="button" disabled={devices.busy} onClick={beginMacChoice}>Use another Mac</button>
          </div>
        </section>
      ) : choosingMac ? (
        <section className="device-picker" aria-labelledby="choose-mac-title">
          <h2 id="choose-mac-title">Choose a paired Mac</h2>
          <p>Choose where you want to practise. Only that Mac will receive this Path, and it will ask before opening any link.</p>
          <div className="device-picker__list">
            {devices.devices.filter((device) => device.status === 'active').map((device) => (
              <button type="button" className="device-choice" disabled={devices.busy} key={device.id} onClick={() => { void activate(device.id) }}>
                <span><Laptop size={18} /></span><span><strong>{device.name}</strong><small>{device.platform} · Paired</small></span><ArrowRight size={17} />
              </button>
            ))}
          </div>
          <button className="text-button" type="button" onClick={() => setChoosingMac(false)}>Cancel</button>
        </section>
      ) : !account ? (
        <button className="primary-button sticky-action" type="button" disabled={walletKind !== 'nimiq'} onClick={onConnect}>
          Connect Nimiq wallet <ArrowRight size={17} />
        </button>
      ) : (
        <button className="primary-button sticky-action" type="button" disabled={devices.busy || !skill.runtimeReady} onClick={() => { void beginMacChoice() }}>
          {devices.busy ? 'Waiting for approval…' : 'Start or continue on my Mac'} <ArrowRight size={17} />
        </button>
      )}

      {devices.learningMessage && <p className="learning-status" role="status">{devices.learningMessage}</p>}
      {account && devices.ready && devices.devices.every((device) => device.status !== 'active') && <div className="quiet-card">
        <h2>No active Mac yet</h2><p>Pair a Mac before starting this Path.</p>
        <button className="secondary-button" type="button" onClick={onShowDevices}>Open Devices</button>
      </div>}
    </main>
  )
}
