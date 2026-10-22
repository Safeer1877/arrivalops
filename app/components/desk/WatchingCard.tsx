'use client'

import type { Observation, ReviewCase } from '@/lib/arrivalops/types'
import { clock } from './format'

/** A car has stopped but hasn't waited long enough to need anyone. Shown quietly so staff aren't nagged. */
export function WatchingCard({ c, obs, dwellSeconds, now }: { c: ReviewCase; obs?: Observation; dwellSeconds: number; now: number }) {
  const waited = Math.max(0, (now - new Date(c.firstSeenAt).getTime()) / 1000)
  const v = obs?.vision
  const label = [v?.colour, v?.vehicleType].filter(Boolean).join(' ') || 'a car'
  const name = label[0].toUpperCase() + label.slice(1)
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm">
      <span className="h-2.5 w-2.5 flex-none rounded-full bg-amber-400 motion-safe:animate-pulse" aria-hidden />
      <p className="min-w-0 flex-1 text-slate-700">
        <span className="font-semibold">{name}</span> stopped in the pickup bay. Alerting staff if it is still there after{' '}
        {clock(dwellSeconds)}.
      </p>
      <span className="flex-none tabular-nums text-slate-500">{clock(waited)}</span>
    </div>
  )
}
