'use client'

import type { ActionInput } from '@/lib/arrivalops/store'
import type { Order } from '@/lib/arrivalops/types'
import { money, relMinutes, time } from './format'

interface Props {
  orders: Order[]
  now: number
  busy: boolean
  act: (a: ActionInput) => void
}

function status(o: Order, now: number): { label: string; tone: string } {
  if (o.handedOverAt) return { label: `Collected ${time(o.handedOverAt)}`, tone: 'bg-slate-100 text-slate-500' }
  if (o.checkIn?.source === 'staff_rescue') return { label: 'Found by camera', tone: 'bg-emerald-100 text-emerald-800' }
  if (o.checkIn) return { label: 'Checked in via app', tone: 'bg-sky-100 text-sky-800' }
  if (new Date(o.readyAt).getTime() > now) return { label: 'Preparing', tone: 'bg-slate-100 text-slate-600' }
  if (new Date(o.pickupAt).getTime() < now)
    return { label: `Overdue · ${relMinutes(o.pickupAt, now).replace(' ago', '')}`, tone: 'bg-rose-100 text-rose-800' }
  return { label: 'Ready · not checked in', tone: 'bg-amber-100 text-amber-800' }
}

export function PickupQueue({ orders, now, busy, act }: Props) {
  const sorted = [...orders].sort(
    (a, b) => Number(Boolean(a.handedOverAt)) - Number(Boolean(b.handedOverAt)) || a.pickupAt.localeCompare(b.pickupAt),
  )
  return (
    <section aria-labelledby="queue-h">
      <div className="flex items-center justify-between">
        <h2 id="queue-h" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pickup orders
        </h2>
        <span
          title="No point-of-sale system is connected in this build"
          className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500"
        >
          Simulated orders
        </span>
      </div>
      <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {sorted.map((o) => {
          const s = status(o, now)
          return (
            <li
              key={o.id}
              className={`flex flex-wrap items-center justify-end gap-x-3 gap-y-2 px-4 py-3 ${o.handedOverAt ? 'opacity-60' : ''}`}
            >
              <div className="min-w-[12rem] flex-1">
                <p className="truncate font-semibold text-slate-900">
                  #{o.code} · {o.customer}
                </p>
                <p className="truncate text-sm text-slate-500">
                  <span className="tabular-nums">{time(o.pickupAt)}</span> · {o.items.join(', ')} · {money(o.totalCents)}
                </p>
              </div>
              <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${s.tone}`}>{s.label}</span>
              {!o.handedOverAt && o.checkIn && (
                <button
                  disabled={busy}
                  onClick={() => act({ action: 'hand_over', orderId: o.id })}
                  className="min-h-11 flex-none rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Handed over
                </button>
              )}
            </li>
          )
        })}
        {!sorted.length && <li className="px-4 py-6 text-center text-sm text-slate-500">No pickups due in the next hour.</li>}
      </ul>
    </section>
  )
}
