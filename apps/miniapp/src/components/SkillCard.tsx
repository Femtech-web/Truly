import { ArrowUpRight, LockKeyhole } from 'lucide-react'
import type { Skill } from '../types'
import { ProgressRing } from './ProgressRing'

interface SkillCardProps {
  skill: Skill
  onOpen: () => void
}

export function SkillCard({ skill, onOpen }: SkillCardProps) {
  return (
    <button className={`skill-card skill-card--${skill.theme}`} type="button" onClick={onOpen}>
      <span className="skill-card__topline">
        <span>{skill.eyebrow}</span>
        {skill.price > 0 ? (
          <span className="skill-price"><LockKeyhole size={12} /> {skill.price} NIM</span>
        ) : (
          <span className="skill-price">Free</span>
        )}
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
