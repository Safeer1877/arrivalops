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
    <ol className="divide-y divide-slate-100">
      {entries.map((e) => (
        <li key={e.id} className="flex items-baseline gap-3 px-4 py-1.5 text-[13px]">
          <span className={`h-1.5 w-1.5 flex-none -translate-y-0.5 rounded-full ${DOT[e.kind]}`} aria-hidden />
          <span className="w-16 flex-none whitespace-nowrap tabular-nums text-slate-400">{time(e.at)}</span>
          <span className="min-w-0 text-slate-700">{e.text}</span>
        </li>
      ))}
      {!entries.length && <li className="px-4 py-3 text-[13px] text-slate-400">Nothing yet today.</li>}
    </ol>
  )
}
