import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { coreRequest } from '../core/client'
import { SkillCard } from '../components/SkillCard'
import type { Skill } from '../types'

interface Props { slug: string; skills: Skill[]; ownedPathIds: string[]; onBack: () => void; onOpenPath: (skill: Skill) => void }
export function CreatorProfileScreen({ slug, skills, ownedPathIds, onBack, onOpenPath }: Props) {
  const [profile, setProfile] = useState<{ slug: string; displayName: string; bio: string } | null>(null)
  const [message, setMessage] = useState('Loading creator…'), [retry, setRetry] = useState(0)
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setProfile(null); setMessage('Loading creator…')
    void coreRequest<{ creator: { slug: string; displayName: string; bio: string } }>(`/v1/creators/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(result => { if (current) { setProfile(result.creator); setMessage('') } })
      .catch(error => { if (current) setMessage(error instanceof Error ? error.message : 'Creator could not be loaded.') })
    return () => { current = false; controller.abort() }
  }, [slug, retry])
  const paths = skills.filter(skill => skill.creator.slug === slug)
  return <main className="screen creator-profile page-enter"><button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Back to Path</button>
    {profile ? <><section className="screen-intro"><span className="studio-kicker">Creator</span><h1>{profile.displayName}</h1><p>{profile.bio || 'Learning Paths made to help you practise.'}</p></section><section className="studio-path-list"><h2>Published Paths</h2>{paths.map(path => <SkillCard key={path.id} skill={path} owned={ownedPathIds.includes(path.id)} onOpen={() => onOpenPath(path)} />)}{!paths.length && <p>No published Paths in the current catalog.</p>}</section></> : <section className="quiet-card"><p role="status">{message}</p><button className="text-button" onClick={() => setRetry(value => value + 1)}>Retry</button></section>}
  </main>
}
