import { type ElementType, type ReactNode, useEffect, useRef, useState } from 'react'

interface RevealProps {
  as?: ElementType
  children: ReactNode
  className?: string
  delay?: number
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

export function Reveal({ as: Tag = 'div', children, className = '', delay = 0, ...landmarkProps }: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        element.animate(
          [
            { opacity: 0, transform: 'translateY(28px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: 700,
            delay,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'both',
          },
        )
        setVisible(true)
        observer.unobserve(entry.target)
      },
      { rootMargin: '0px 0px -9% 0px', threshold: 0.12 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [delay])

  return (
    <Tag
      ref={elementRef}
      className={`reveal${visible ? ' reveal--visible' : ''}${className ? ` ${className}` : ''}`}
      {...landmarkProps}
    >
      {children}
    </Tag>
  )
}
