import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getHostLanguage } from '@nimiq/mini-app-sdk'
import { AppHeader } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { useCatalog } from './hooks/useCatalog'
import { useWallet } from './hooks/useWallet'
import { usePairing } from './hooks/usePairing'
import { useDevices } from './hooks/useDevices'
import { DevicesScreen } from './screens/DevicesScreen'
import { HomeScreen } from './screens/HomeScreen'
import { LearnScreen } from './screens/LearnScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { SkillDetailScreen } from './screens/SkillDetailScreen'
import { TaskDetailScreen } from './screens/TaskDetailScreen'
import { WalletScreen } from './screens/WalletScreen'
import type { AppTab, LearnView, LearningTask, Skill } from './types'

export function App() {
  const wallet = useWallet()
  const pairing = usePairing({ account: wallet.account, walletKind: wallet.kind, signMessage: wallet.signMessage })
  const devices = useDevices(wallet.account, wallet.signMessage)
  const catalog = useCatalog()
  const [hasEntered, setHasEntered] = useState(false)
  const [tab, setTab] = useState<AppTab>('home')
  const [learnView, setLearnView] = useState<LearnView>('tasks')
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [selectedTask, setSelectedTask] = useState<LearningTask | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [hasEntered, tab, learnView, selectedSkill?.id, selectedTask?.id])

  useEffect(() => {
    document.documentElement.lang = getHostLanguage() || navigator.language || 'en'
  }, [])

  useEffect(() => {
    if (wallet.status === 'connected') setHasEntered(true)
  }, [wallet.status])

  const walletState = useMemo(() => ({
    status: wallet.status,
    kind: wallet.kind,
    account: wallet.account,
    consensus: wallet.consensus,
    message: wallet.message,
  }), [wallet.account, wallet.consensus, wallet.kind, wallet.message, wallet.status])

  const showTab = (nextTab: AppTab) => {
    setSelectedSkill(null)
    setSelectedTask(null)
    setTab(nextTab)
  }

  const openSkill = (skill: Skill) => {
    setSelectedTask(null)
    setSelectedSkill(skill)
  }

  const openTask = (task: LearningTask) => {
    setSelectedSkill(null)
    setSelectedTask(task)
  }

  const showLearn = (view: LearnView) => {
    setSelectedSkill(null)
    setSelectedTask(null)
    setLearnView(view)
    setTab('learn')
  }

  const resumeActive = () => {
    const active = devices.activeLearning
    if (!active) { showLearn('tasks'); return }
    if (active.source.kind === 'path') {
      const path = catalog.skills.find((item) => item.id === active.source.id)
      if (path) openSkill(path)
      else showLearn('paths')
      return
    }
    const task = devices.tasks.find((item) => item.id === active.source.id)
    if (task) openTask(task)
    else showLearn('tasks')
  }

  const disconnectWallet = () => {
    wallet.disconnect()
    setSelectedSkill(null)
    setSelectedTask(null)
    setTab('home')
    setHasEntered(false)
  }

  if (!hasEntered) {
    return <div className="miniapp-shell miniapp-shell--onboarding"><OnboardingScreen wallet={walletState} onConnect={wallet.connect} onBrowse={() => setHasEntered(true)} /></div>
  }

  return (
    <div className="miniapp-shell">
      <AppHeader wallet={walletState} onConnect={wallet.connect} onShowWallet={() => showTab('wallet')} />
      <div className="app-content" ref={contentRef}>
        {(tab === 'home' || tab === 'learn') && catalog.status !== 'ready' && <div className="inline-note inline-note--neutral" role="status"><p>{catalog.status === 'loading' ? 'Loading Paths…' : catalog.message}</p>{catalog.status === 'failed' && <button className="text-button" type="button" onClick={catalog.reload}>Retry</button>}</div>}

        {selectedTask ? <TaskDetailScreen task={selectedTask} devices={devices} onBack={() => setSelectedTask(null)} onShowDevices={() => showTab('devices')} />
          : selectedSkill ? <SkillDetailScreen skill={selectedSkill} devices={devices} account={wallet.account} walletKind={wallet.kind} onBack={() => setSelectedSkill(null)} onConnect={wallet.connect} onShowDevices={() => showTab('devices')} />
            : tab === 'home' ? <HomeScreen skills={catalog.skills} activeLearning={devices.activeLearning} onOpenSkill={openSkill} onResumeActive={resumeActive} onShowTasks={() => showLearn('tasks')} onShowPaths={() => showLearn('paths')} onShowDevices={() => showTab('devices')} />
              : tab === 'learn' ? <LearnScreen view={learnView} onViewChange={setLearnView} skills={catalog.skills} devices={devices} isConnected={wallet.status === 'connected'} onConnect={wallet.connect} onOpenPath={openSkill} onOpenTask={openTask} />
                : tab === 'devices' ? <DevicesScreen pairing={pairing} devices={devices} account={wallet.account} walletKind={wallet.kind} onConnect={wallet.connect} />
                  : tab === 'progress' ? <ProgressScreen />
                    : wallet.account ? <WalletScreen account={wallet.account} onBack={() => showTab('home')} onShowDevices={() => showTab('devices')} onDisconnect={disconnectWallet} /> : null}
      </div>
      {!selectedSkill && !selectedTask && tab !== 'wallet' && <BottomNav active={tab} onChange={showTab} />}
    </div>
  )
}
