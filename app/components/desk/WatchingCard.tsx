'use client'

import type { Observation, ReviewCase } from '@/lib/arrivalops/types'
import { vehicleLabel } from './CaseCard'
import { clock } from './format'

/** A car has stopped but hasn't waited long enough to need anyone. Shown quietly so staff aren't nagged. */
export function WatchingCard({ c, obs, dwellSeconds, now }: { c: ReviewCase; obs?: Observation; dwellSeconds: number; now: number }) {
  const waited = Math.max(0, (now - new Date(c.firstSeenAt).getTime()) / 1000)
  const left = Math.max(0, dwellSeconds - waited)
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]">
      <span className="h-2 w-2 flex-none rounded-full bg-amber-400 motion-safe:animate-pulse" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-slate-700">
        <span className="font-medium text-slate-900">{vehicleLabel(obs)}</span> stopped in the bay
      </p>
      <span className="flex-none text-xs tabular-nums text-slate-500">Alert in {clock(left)}</span>
    </div>
  )
}
