import { ArrowRight, Laptop } from 'lucide-react'
import type { ActiveLearningSession, Skill } from '../types'
import { SkillCard } from '../components/SkillCard'

interface HomeScreenProps {
  skills: Skill[]
  activeLearning: ActiveLearningSession | null
  onOpenSkill: (skill: Skill) => void
  onResumeActive: () => void
  onShowTasks: () => void
  onShowPaths: () => void
  onShowDevices: () => void
}

export function HomeScreen({ skills, activeLearning, onOpenSkill, onResumeActive, onShowTasks, onShowPaths, onShowDevices }: HomeScreenProps) {
  return (
    <main className="screen home-screen page-enter">
      <section className="home-lead"><h1>Learn by doing.</h1><p>Start with your own goal or follow a Path shaped by a creator.</p></section>

      {activeLearning && <button className="resume-card" type="button" onClick={onResumeActive}>
        <span className="resume-card__topline"><span>{activeLearning.source.kind === 'task' ? 'Private Task' : `By ${activeLearning.source.creatorName}`}</span><span>{activeLearning.currentStep.index} of {activeLearning.currentStep.total}</span></span>
        <span className="resume-card__body"><span><strong>{activeLearning.source.title}</strong><small>{activeLearning.currentStep.title}</small></span></span>
        <span className="resume-card__action">Continue <ArrowRight size={16} /></span>
      </button>}

      <div className="home-choice-grid">
        <button type="button" onClick={onShowTasks}><span>My Tasks</span><strong>Start something personal</strong><small>Make a private plan from one goal.</small><ArrowRight size={16} /></button>
        <button type="button" onClick={onShowPaths}><span>Explore Paths</span><strong>Learn with a creator</strong><small>Follow reviewed steps and resources.</small><ArrowRight size={16} /></button>
      </div>

      <section className="section-stack">
        <div className="section-heading"><h2>Paths to explore</h2><button className="text-button" type="button" onClick={onShowPaths}>See all</button></div>
        {skills.slice(0, 2).map((skill) => <SkillCard key={skill.id} skill={skill} onOpen={() => onOpenSkill(skill)} />)}
      </section>

      <button className="device-callout" type="button" onClick={onShowDevices}><span className="device-callout__icon"><Laptop size={20} /></span><span><strong>Connect your Mac</strong><small>Continue learning where the real work happens.</small></span><ArrowRight size={17} /></button>
    </main>
  )
}
