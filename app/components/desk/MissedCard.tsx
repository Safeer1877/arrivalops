'use client'

import { candidateReasons } from '@/lib/arrivalops/reconcile'
import type { ActionInput } from '@/lib/arrivalops/store'
import type { Observation, Order } from '@/lib/arrivalops/types'
import { money } from './format'

interface Props {
  caseId: string
  confirmed: boolean
  busy: boolean
  act: (a: ActionInput) => void
  text: string
  orders: Order[]
  obs?: Observation
  now: number
}

/**
 * A car left after staff were alerted. The camera only saw it go, so staff say whether it was a customer; until
 * then it isn't counted as a missed pickup. Either way the food is still on the shelf, so show who it most likely
 * was and how to reach them.
 */
export function MissedCard({ caseId, confirmed, busy, act, text, orders, obs, now }: Props) {
  return (
    <article className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
      <span
        className={`rounded px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide ${confirmed ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-800'}`}
      >
        {confirmed ? 'Missed pickup' : 'Left before anyone came out'}
      </span>
      <p className="mt-1.5 text-sm font-semibold text-slate-900">{text}</p>
      {!confirmed && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-600">Was it a customer?</span>
          <button
            disabled={busy}
            onClick={() => act({ action: 'review_departure', caseId, verdict: 'missed' })}
            className="h-7 rounded-md bg-rose-600 px-2.5 font-semibold text-white hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-50"
          >
            Yes, a missed pickup
          </button>
          <button
            disabled={busy}
            onClick={() => act({ action: 'review_departure', caseId, verdict: 'not_a_customer' })}
            className="h-7 rounded-md px-2.5 font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 disabled:opacity-50"
          >
            Not a customer
          </button>
        </div>
      )}
      {orders.length ? (
        <>
          <p className="mt-2 text-xs text-slate-600">If it was a customer, their order is still on the shelf. Most likely:</p>
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
