export function availableAccounts(values: string[]): string[] {
  return [...new Set(values.map(value => value.replace(/\s/g, '').toUpperCase())
    .filter(value => /^NQ\d{2}[0-9A-Z]{32}$/.test(value)))].slice(0, 100)
}

export function requireSigningAccount(selected: string, available: string[]): void {
  if (selected !== available[0]) {
    throw new Error('Nimiq Pay can only sign Mini App requests with its primary account. Reconnect with that account to continue.')
  }
}

// Preserve the current identity on rejected discovery. The caller separately
// restricts signed Mini App identity to the provider's primary account.
export async function changeAccount(input: {
  selected: string; available: string[]; current: string | null;
  endSession: () => Promise<void>; commit: (account: string) => void;
}): Promise<void> {
  if (!input.available.includes(input.selected)) throw new Error('Refresh accounts in Nimiq Pay before choosing this wallet.')
  if (input.selected === input.current) return
  // A first connection has no Truly identity to end and must not depend on Core.
  // A real switch remains fail-closed so two wallets cannot share one session.
  if (input.current !== null) await input.endSession()
  input.commit(input.selected)
}
