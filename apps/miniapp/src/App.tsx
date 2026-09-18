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
import { CreatorStudioScreen } from './screens/CreatorStudioScreen'
import { CreatorProfileScreen } from './screens/CreatorProfileScreen'
import { ReviewQueueScreen } from './screens/ReviewQueueScreen'
import { WalletConnectSheet } from './components/WalletConnectSheet'
import type { AppTab, LearnView, LearningTask, Skill } from './types'
import { readNavigation, saveNavigation } from './core/navigation'

export function App() {
  const wallet = useWallet()
  const [walletSheetOpen, setWalletSheetOpen] = useState(false)
  // An identity change unmounts every private-data/permission holder immediately.
  return <><WalletApp key={wallet.account ?? 'disconnected'} wallet={wallet} onConnect={() => setWalletSheetOpen(true)} />
    <WalletConnectSheet open={walletSheetOpen} account={wallet.account} onClose={() => setWalletSheetOpen(false)} onDiscover={wallet.connect} onSelect={wallet.selectAccount} onReconnect={wallet.disconnect} /></>
}

function WalletApp({ wallet, onConnect }: { wallet: ReturnType<typeof useWallet>; onConnect: () => void }) {
  const pairing = usePairing({ account: wallet.account, walletKind: wallet.kind, signMessage: wallet.signMessage })
  const devices = useDevices(wallet.account, wallet.signMessage)
  const catalog = useCatalog()
  const [navigation] = useState(readNavigation)
  const [hasEntered, setHasEntered] = useState(navigation.entered)
  const [tab, setTab] = useState<AppTab>(navigation.tab)
  const [learnView, setLearnView] = useState<LearnView>(navigation.learnView)
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [selectedTask, setSelectedTask] = useState<LearningTask | null>(null)
  const [studioOpen, setStudioOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [creatorSlug, setCreatorSlug] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [hasEntered, tab, learnView, selectedSkill?.id, selectedTask?.id, studioOpen, reviewOpen, creatorSlug])

  useEffect(() => {
    document.documentElement.lang = getHostLanguage() || navigator.language || 'en'
  }, [])

  useEffect(() => {
    if (wallet.status === 'connected') setHasEntered(true)
  }, [wallet.status])
  useEffect(() => { saveNavigation({ entered: hasEntered, tab, learnView }) }, [hasEntered, tab, learnView])

  const walletState = useMemo(() => ({
    status: wallet.status,
    kind: wallet.kind,
    account: wallet.account,
    consensus: wallet.consensus,
    message: wallet.message,
  }), [wallet.account, wallet.consensus, wallet.kind, wallet.message, wallet.status])

  const showTab = (nextTab: AppTab) => {
    setStudioOpen(false)
    setReviewOpen(false)
    setCreatorSlug(null)
    setSelectedSkill(null)
    setSelectedTask(null)
    setTab(nextTab)
  }

  const openSkill = (skill: Skill) => {
    setCreatorSlug(null)
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

  const disconnectWallet = async () => {
    if (!await wallet.disconnect()) return
    setStudioOpen(false)
    setCreatorSlug(null)
    setSelectedSkill(null)
    setSelectedTask(null)
    setTab('home')
    setHasEntered(false)
  }

  if (!hasEntered) {
    return <div className="miniapp-shell miniapp-shell--onboarding"><OnboardingScreen wallet={walletState} onConnect={onConnect} onBrowse={() => setHasEntered(true)} /></div>
  }

  return (
    <div className="miniapp-shell">
      <AppHeader wallet={walletState} onConnect={onConnect} onShowWallet={() => showTab('wallet')} />
      <div className="app-content" ref={contentRef}>
        {(tab === 'home' || tab === 'learn') && catalog.status !== 'ready' && <div className="inline-note inline-note--neutral" role="status"><p>{catalog.status === 'loading' ? 'Loading Paths…' : catalog.message}</p>{catalog.status === 'failed' && <button className="text-button" type="button" onClick={catalog.reload}>Retry</button>}</div>}

        {reviewOpen && wallet.account ? <ReviewQueueScreen account={wallet.account} signMessage={wallet.signMessage} onBack={() => setReviewOpen(false)} onPublishedChange={catalog.reload} />
          : studioOpen && wallet.account ? <CreatorStudioScreen key={wallet.account} account={wallet.account} signMessage={wallet.signMessage} onBack={() => setStudioOpen(false)} onPublishedChange={catalog.reload} onOpenReviews={() => setReviewOpen(true)} />
          : creatorSlug ? <CreatorProfileScreen slug={creatorSlug} skills={catalog.skills} ownedPathIds={devices.ownedPathIds} onBack={() => setCreatorSlug(null)} onOpenPath={openSkill} />
          : selectedTask ? <TaskDetailScreen task={selectedTask} devices={devices} onBack={() => setSelectedTask(null)} onShowDevices={() => showTab('devices')} />
          : selectedSkill ? <SkillDetailScreen skill={selectedSkill} devices={devices} account={wallet.account} walletKind={wallet.kind} payNim={wallet.payNim} onBack={() => setSelectedSkill(null)} onConnect={onConnect} onShowDevices={() => showTab('devices')} onOpenCreator={() => setCreatorSlug(selectedSkill.creator.slug)} />
            : tab === 'home' ? <HomeScreen skills={catalog.skills} ownedPathIds={devices.ownedPathIds} activeLearning={devices.activeLearning} onOpenSkill={openSkill} onResumeActive={resumeActive} onShowTasks={() => showLearn('tasks')} onShowPaths={() => showLearn('paths')} onShowDevices={() => showTab('devices')} />
              : tab === 'learn' ? <LearnScreen view={learnView} onViewChange={setLearnView} skills={catalog.skills} devices={devices} isConnected={wallet.status === 'connected'} onConnect={onConnect} onOpenPath={openSkill} onOpenTask={openTask} onCreatePath={() => wallet.account ? setStudioOpen(true) : onConnect()} />
                : tab === 'devices' ? <DevicesScreen pairing={pairing} devices={devices} account={wallet.account} walletKind={wallet.kind} onConnect={onConnect} />
                  : tab === 'progress' ? <ProgressScreen devices={devices} connected={wallet.status === 'connected'} onConnect={onConnect} />
                    : wallet.account ? <WalletScreen account={wallet.account} message={wallet.message} accessReady={devices.ready} loadWalletActivity={devices.loadWalletActivity} onBack={() => showTab('home')} onShowDevices={() => showTab('devices')} onDisconnect={disconnectWallet} onOpenStudio={() => setStudioOpen(true)} onSwitchAccount={onConnect} /> : <HomeScreen skills={catalog.skills} ownedPathIds={devices.ownedPathIds} activeLearning={null} onOpenSkill={openSkill} onResumeActive={resumeActive} onShowTasks={() => showLearn('tasks')} onShowPaths={() => showLearn('paths')} onShowDevices={() => showTab('devices')} />}
      </div>
      {!studioOpen && !reviewOpen && !creatorSlug && !selectedSkill && !selectedTask && tab !== 'wallet' && <BottomNav active={tab} onChange={showTab} />}
    </div>
  )
}
