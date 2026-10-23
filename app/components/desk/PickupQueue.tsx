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
  if (o.handedOverAt) return { label: 'Collected', tone: 'bg-slate-50 text-slate-400 ring-slate-200' }
  if (o.checkIn?.source === 'staff_rescue') return { label: 'Staff verified', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
  if (o.checkIn) return { label: 'Checked in', tone: 'bg-sky-50 text-sky-700 ring-sky-200' }
  if (new Date(o.readyAt).getTime() > now) return { label: 'Preparing', tone: 'bg-slate-50 text-slate-600 ring-slate-200' }
  if (new Date(o.pickupAt).getTime() < now)
    return { label: `Overdue ${relMinutes(o.pickupAt, now).replace(' ago', '')}`, tone: 'bg-rose-50 text-rose-700 ring-rose-200' }
  return { label: 'Ready', tone: 'bg-amber-50 text-amber-700 ring-amber-200' }
}

/** The day's pickups as a dense list: who, when, what, and where each one stands. */
export function PickupQueue({ orders, now, busy, act }: Props) {
  const sorted = [...orders].sort(
    (a, b) => Number(Boolean(a.handedOverAt)) - Number(Boolean(b.handedOverAt)) || a.pickupAt.localeCompare(b.pickupAt),
  )
  return (
    <table className="w-full table-fixed text-[13px]">
      <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wide text-slate-400">
        <tr className="border-b border-slate-100">
          <th className="w-[4.75rem] py-1.5 pl-4 font-medium">Due</th>
          <th className="py-1.5 font-medium">Order</th>
          <th className="w-16 py-1.5 text-right font-medium">Total</th>
          <th className="w-[8.5rem] py-1.5 pl-3 pr-4 font-medium">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sorted.map((o) => {
          const s = status(o, now)
          return (
            <tr key={o.id} className={o.handedOverAt ? 'text-slate-400' : 'text-slate-700'}>
              <td className="whitespace-nowrap py-2 pl-4 align-top tabular-nums">{time(o.pickupAt)}</td>
              <td className="min-w-0 py-2 align-top">
                <p className={`truncate font-medium ${o.handedOverAt ? '' : 'text-slate-900'}`}>
                  #{o.code} {o.customer}
                </p>
                <p className="truncate text-xs text-slate-400">{o.items.join(', ')}</p>
              </td>
              <td className="py-2 text-right align-top tabular-nums">{money(o.totalCents)}</td>
              <td className="py-1.5 pl-3 pr-4 align-top">
                {!o.handedOverAt && o.checkIn ? (
                  <button
                    disabled={busy}
                    onClick={() => act({ action: 'hand_over', orderId: o.id })}
                    title={`${s.label}. Mark as handed over`}
                    className="h-7 w-full rounded-md bg-white px-2 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 disabled:opacity-50"
                  >
                    Hand over
                  </button>
                ) : (
                  <span
                    className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.tone}`}
                  >
                    {s.label}
                    {o.handedOverAt && ` ${time(o.handedOverAt)}`}
                  </span>
                )}
              </td>
            </tr>
          )
        })}
        {!sorted.length && (
          <tr>
            <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
              No pickups due in the next hour.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
