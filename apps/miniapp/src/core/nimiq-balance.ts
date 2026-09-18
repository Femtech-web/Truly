const LUNA_PER_NIM = 100_000n

export function formatNimBalance(value: string, locale?: string): string {
  if (!/^\d+$/.test(value)) return '—'
  const atomic = BigInt(value)
  const whole = atomic / LUNA_PER_NIM
  const fraction = (atomic % LUNA_PER_NIM).toString().padStart(5, '0').replace(/0+$/, '')
  const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(whole)
  return `${integer}${fraction ? `.${fraction}` : ''} NIM`
}
