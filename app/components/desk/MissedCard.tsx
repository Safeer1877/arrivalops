'use client'

import { candidateReasons } from '@/lib/arrivalops/reconcile'
import type { Observation, Order } from '@/lib/arrivalops/types'
import { money } from './format'

/** A driver gave up. Their food is still on the shelf, so show who it most likely was and how to reach them. */
export function MissedCard({ text, orders, obs, now }: { text: string; orders: Order[]; obs?: Observation; now: number }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Missed pickup</p>
      <p className="mt-1 text-balance font-semibold text-slate-900">{text}.</p>
      {orders.length ? (
        <>
          <p className="mt-1 text-sm text-slate-600">Their order is still on the shelf. Most likely:</p>
          <ul className="mt-2 space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    #{o.code} · {o.customer} <span className="font-normal text-slate-500">· {money(o.totalCents)}</span>
                  </p>
                  <p className="text-xs text-slate-500">{(obs ? candidateReasons(o, obs, new Date(now)) : []).join(' · ')}</p>
                </div>
                {o.phone && (
                  <a href={`tel:${o.phone.replace(/[^\d+]/g, '')}`} className="flex-none text-sm font-semibold text-slate-900 underline">
                    Call {o.phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Phone numbers are simulated demo data.</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-600">Their order is still on the shelf.</p>
      )}
    </div>
  )
}
