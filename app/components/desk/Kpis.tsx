import type { Metrics } from '@/lib/arrivalops/metrics'
import { clock, money } from './format'

function Tile({ label, value, sub, tone = 'text-slate-900' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export function Kpis({ m }: { m: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Cars waiting, no check-in"
        value={String(m.openCases)}
        tone={m.openCases ? 'text-amber-600' : 'text-slate-900'}
        sub={m.openCases ? 'Someone needs to go outside' : 'All clear'}
      />
      <Tile
        label="Food going cold"
        value={money(m.valueAtRiskCents)}
        tone={m.valueAtRiskCents ? 'text-rose-600' : 'text-slate-900'}
        sub={`${m.ordersAtRisk} ready order${m.ordersAtRisk === 1 ? '' : 's'} past pickup, no check-in`}
      />
      <Tile
        label="Rescued today"
        value={String(m.rescuedToday)}
        sub={
          m.medianSecondsToAcknowledge === null
            ? 'Handed over after the camera spotted them'
            : `Median ${clock(m.medianSecondsToAcknowledge)} from alert to staff outside`
        }
      />
      <Tile
        label="Missed today"
        value={String(m.missedToday)}
        tone={m.missedToday ? 'text-rose-600' : 'text-slate-900'}
        sub="Drove off before anyone came out"
      />
    </div>
  )
}
