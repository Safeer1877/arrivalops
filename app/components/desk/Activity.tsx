import type { ActivityEntry } from '@/lib/arrivalops/types'
import { time } from './format'

const DOT: Record<ActivityEntry['kind'], string> = {
  observation: 'bg-slate-300',
  case_opened: 'bg-amber-500',
  case_updated: 'bg-amber-300',
  matched: 'bg-emerald-500',
  handed_over: 'bg-emerald-700',
  dismissed: 'bg-slate-400',
  check_in: 'bg-sky-500',
  undo: 'bg-violet-500',
  chime: 'bg-amber-600',
  vision_error: 'bg-rose-500',
  left: 'bg-rose-600',
  settings: 'bg-slate-400',
}

export function Activity({ entries }: { entries: ActivityEntry[] }) {
  return (
    <section aria-labelledby="activity-h">
      <h2 id="activity-h" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Activity
      </h2>
      <ol className="mt-2 space-y-2">
        {entries.slice(0, 12).map((e) => (
          <li key={e.id} className="flex items-start gap-3 text-sm">
            <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${DOT[e.kind]}`} aria-hidden />
            <span className="w-20 flex-none whitespace-nowrap tabular-nums text-slate-400">{time(e.at)}</span>
            <span className="text-slate-700">{e.text}</span>
          </li>
        ))}
        {!entries.length && <li className="text-sm text-slate-400">Nothing yet today.</li>}
      </ol>
    </section>
  )
}
