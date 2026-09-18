export type PathAccessPresentation = {
  kind: 'free' | 'paid' | 'owned'
  label: string
}

export function pathAccessPresentation(input: { price: number; owned: boolean }): PathAccessPresentation {
  if (input.owned) return { kind: 'owned', label: 'Unlocked' }
  if (input.price > 0) return { kind: 'paid', label: `${input.price} NIM` }
  return { kind: 'free', label: 'Free' }
}
