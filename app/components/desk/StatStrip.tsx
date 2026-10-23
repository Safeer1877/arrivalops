import type { Metrics } from '@/lib/arrivalops/metrics'
import { clock, money } from './format'

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'amber' | 'rose' }) {
  const colour = tone === 'amber' ? 'text-amber-300' : tone === 'rose' ? 'text-rose-300' : 'text-white'
  return (
    <div title={hint} className="min-w-0 pr-3 sm:px-3 sm:first:pl-0 lg:px-4">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-lg font-semibold leading-6 tabular-nums ${colour}`}>{value}</p>
    </div>
  )
}

/** Today's numbers, kept to one line in the top bar so the camera and alerts get the screen. */
export function StatStrip({ m }: { m: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-y-2 sm:grid-cols-4 sm:divide-x sm:divide-slate-700">
      <Stat
        label="Waiting, no check-in"
        value={String(m.openCases)}
        tone={m.openCases ? 'amber' : undefined}
        hint="Cars in the pickup bay that staff have been alerted about"
      />
      <Stat
        label="Uncollected value"
        value={money(m.valueAtRiskCents)}
        tone={m.valueAtRiskCents ? 'rose' : undefined}
        hint={`Sale value of ${m.ordersAtRisk} ready order${m.ordersAtRisk === 1 ? '' : 's'} past pickup time with no check-in. Money on the shelf, not a measured loss.`}
      />
      <Stat
        label="Rescued today"
        value={String(m.rescuedToday)}
        hint={
          m.medianSecondsToAcknowledge === null
            ? 'Handed over after the camera spotted them'
            : `Median ${clock(m.medianSecondsToAcknowledge)} from alert to staff confirmation`
        }
      />
      <Stat
        label="Missed today"
        value={String(m.missedToday)}
        tone={m.missedToday ? 'rose' : undefined}
        hint="Drove off after the alert before anyone came out, and staff confirmed it was a customer"
      />
    </div>
  )
}
