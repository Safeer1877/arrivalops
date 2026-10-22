const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'USD'

// Whole amounts drop the cents ("$44"); others keep them ("$18.50"), so the tiles add up to the rows.
export const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(
    cents / 100,
  )

export function clock(seconds: number | null): string {
  if (seconds === null) return '—'
  const s = Math.max(0, Math.round(seconds))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function relMinutes(iso: string, now: number): string {
  const m = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (m === 0) return 'now'
  return m > 0 ? `${m} min ago` : `in ${-m} min`
}

export const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
