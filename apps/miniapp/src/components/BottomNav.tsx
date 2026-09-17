import { BookOpen, ChartNoAxesColumnIncreasing, House, Laptop } from 'lucide-react'
import type { AppTab } from '../types'

const items = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'learn', label: 'Learn', Icon: BookOpen },
  { id: 'devices', label: 'Devices', Icon: Laptop },
  { id: 'progress', label: 'Progress', Icon: ChartNoAxesColumnIncreasing },
] as const

interface BottomNavProps {
  active: AppTab
  onChange: (tab: AppTab) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map(({ id, label, Icon }) => (
        <button
          className={active === id ? 'bottom-nav__item is-active' : 'bottom-nav__item'}
          type="button"
          key={id}
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          <Icon size={20} strokeWidth={active === id ? 2.3 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
