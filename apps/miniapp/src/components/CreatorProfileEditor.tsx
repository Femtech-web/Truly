import type { CreatorProfile } from '../core/creator-studio'

export interface CreatorProfileNotice {
  kind: 'success' | 'error'
  text: string
}

interface Props {
  profile: CreatorProfile
  busy: boolean
  notice: CreatorProfileNotice | null
  onChange: (profile: CreatorProfile) => void
  onSave: () => void
}

export function CreatorProfileEditor({ profile, busy, notice, onChange, onSave }: Props) {
  return <details className="quiet-card studio-profile">
    <summary><span>Your creator profile</span><span className="profile-status-badge">{profile.status === 'active' ? 'Active' : profile.status}</span></summary>
    <div className="plan-editor">
      <label>Name<input maxLength={80} value={profile.displayName} onChange={event => onChange({ ...profile, displayName: event.target.value })} /></label>
      <label>Bio<textarea maxLength={1000} rows={3} value={profile.bio} onChange={event => onChange({ ...profile, bio: event.target.value })} /></label>
      <label>Avatar link (optional)<input type="url" value={profile.avatarUrl ?? ''} onChange={event => onChange({ ...profile, avatarUrl: event.target.value })} /></label>
      <p className="studio-profile-meta">Public ID: {profile.slug}<br />NIM payments go to your verified wallet: {profile.nimiqAddress}</p>
      <div className="profile-save-actions">
        <button className="secondary-button" type="button" disabled={busy} onClick={onSave}>{busy ? 'Saving…' : 'Save changes'}</button>
        {notice && <p className={`profile-save-status${notice.kind === 'error' ? ' profile-save-status--error' : ''}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      </div>
    </div>
  </details>
}
