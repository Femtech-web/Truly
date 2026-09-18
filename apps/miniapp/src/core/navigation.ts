// Non-sensitive UI preferences only; never account credentials or private Task data.
const key = 'truly.navigation.v1'
export interface Navigation { entered: boolean; tab: 'home' | 'learn' | 'devices' | 'progress' | 'wallet'; learnView: 'tasks' | 'paths' }
export function readNavigation(storage?: Pick<Storage, 'getItem'>): Navigation {
  const initial: Navigation = { entered: false, tab: 'home', learnView: 'tasks' }
  try {
    const value = JSON.parse((storage ?? window.sessionStorage).getItem(key) ?? 'null')
    if (!value || value.entered !== true) return initial
    return { entered: true, tab: ['home', 'learn', 'devices', 'progress'].includes(value.tab) ? value.tab : 'home', learnView: value.learnView === 'paths' ? 'paths' : 'tasks' }
  } catch { return initial }
}
export function saveNavigation(value: Navigation, storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? window.sessionStorage).setItem(key, JSON.stringify(value)) } catch { /* Private mode may disable storage. */ }
}
