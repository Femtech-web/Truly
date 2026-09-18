import { ArrowUpRight, Check, LockKeyhole } from 'lucide-react'
import type { Skill } from '../types'
import { pathAccessPresentation } from '../core/path-access-presentation'
import { ProgressRing } from './ProgressRing'

interface SkillCardProps {
  skill: Skill
  owned: boolean
  onOpen: () => void
}

export function SkillCard({ skill, owned, onOpen }: SkillCardProps) {
  const access = pathAccessPresentation({ price: skill.price, owned })
  return (
    <button className={`skill-card skill-card--${skill.theme}`} type="button" onClick={onOpen}>
      <span className="skill-card__topline">
        <span>{skill.eyebrow}</span>
        <span className={`skill-price skill-price--${access.kind}`}>
          {access.kind === 'paid' && <LockKeyhole size={12} />}
          {access.kind === 'owned' && <Check size={12} />}
          {access.label}
        </span>
      </span>
      <span className="skill-card__body">
        <span>
          <strong>{skill.title}</strong>
          <small>{skill.description}</small>
        </span>
        {skill.progress > 0 ? <ProgressRing value={skill.progress} /> : <ArrowUpRight size={21} />}
      </span>
    </button>
  )
}
