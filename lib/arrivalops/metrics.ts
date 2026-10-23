// The numbers a shop owner cares about: money sitting on the shelf, and how fast waiting customers get served.

import { isDue } from './reconcile'
import type { State } from './types'

export interface Metrics {
  valueAtRiskCents: number // ready, uncollected, no check-in, past pickup time
  ordersAtRisk: number
  openCases: number
  rescuedToday: number // handed over after staff matched an unannounced arrival
  medianSecondsToAcknowledge: number | null // case opened -> staff matched it
  medianSecondsArrivalToHandover: number | null // car stopped -> order handed over
  missedToday: number // alerted, the car drove off before anyone came out, and staff confirmed it was a customer
}

const sec = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 1000)

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2)
}

export function computeMetrics(state: State, now: Date): Metrics {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const atRisk = state.orders.filter((o) => isDue(o, now) && new Date(o.pickupAt) < now)
  const today = state.cases.filter((c) => new Date(c.firstSeenAt ?? c.openedAt) >= startOfDay)
  const handed = today.filter((c) => c.status === 'handed_over' && c.resolvedAt)
  return {
    valueAtRiskCents: atRisk.reduce((sum, o) => sum + o.totalCents, 0),
    ordersAtRisk: atRisk.length,
    openCases: state.cases.filter((c) => c.status === 'needs_review').length,
    missedToday: today.filter((c) => c.status === 'left' && c.departure === 'missed').length,
    rescuedToday: handed.length,
    medianSecondsToAcknowledge: median(today.filter((c) => c.matchedAt).map((c) => sec(c.openedAt, c.matchedAt!))),
    medianSecondsArrivalToHandover: median(handed.map((c) => sec(c.firstSeenAt ?? c.openedAt, c.resolvedAt!))),
  }
}
