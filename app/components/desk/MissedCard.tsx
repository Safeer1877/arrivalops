'use client'

import { candidateReasons } from '@/lib/arrivalops/reconcile'
import type { Observation, Order } from '@/lib/arrivalops/types'
import { money } from './format'

/** A driver gave up. Their food is still on the shelf, so show who it most likely was and how to reach them. */
export function MissedCard({ text, orders, obs, now }: { text: string; orders: Order[]; obs?: Observation; now: number }) {
  return (
    <article className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
      <span className="rounded bg-rose-600 px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide text-white">Missed pickup</span>
      <p className="mt-1.5 text-sm font-semibold text-slate-900">{text}</p>
      {orders.length ? (
        <>
          <p className="mt-0.5 text-xs text-slate-600">Their order is still on the shelf. Most likely:</p>
          <ul className="mt-1.5 divide-y divide-rose-100 rounded-md border border-rose-100 bg-white">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-900">
                    #{o.code} {o.customer} <span className="font-normal text-slate-500">· {money(o.totalCents)}</span>
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{(obs ? candidateReasons(o, obs, new Date(now)) : []).join(' · ')}</p>
                </div>
                {o.phone && (
                  <a
                    href={`tel:${o.phone.replace(/[^\d+]/g, '')}`}
                    className="flex-none whitespace-nowrap rounded px-1.5 py-1 text-xs font-medium text-slate-900 underline hover:bg-rose-50"
                  >
                    Call {o.phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-slate-400">Phone numbers are simulated demo data.</p>
        </>
      ) : (
        <p className="mt-0.5 text-xs text-slate-600">Their order is still on the shelf.</p>
      )}
    </article>
  )
}
