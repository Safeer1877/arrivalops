'use client'

import { candidateReasons } from '@/lib/arrivalops/reconcile'
import type { ActionInput } from '@/lib/arrivalops/store'
import type { Observation, Order, ReviewCase } from '@/lib/arrivalops/types'
import { clock, money } from './format'

interface Props {
  c: ReviewCase
  calloutSeconds: number
  orders: Order[]
  observations: Observation[]
  now: number
  busy: boolean
  act: (a: ActionInput) => void
}

function vehicleLabel(o?: Observation) {
  if (!o) return 'Vehicle'
  const v = o.vision
  if (v.vehiclePresent === 'unclear') return 'Possible vehicle'
  const name = [v.colour, v.vehicleType].filter(Boolean).join(' ')
  return name ? name[0].toUpperCase() + name.slice(1) : 'Vehicle'
}

export function CaseCard({ c, calloutSeconds, orders, observations, now, busy, act }: Props) {
  const obs = observations.find((o) => o.id === c.observationIds[0])
  const waiting = (now - new Date(c.firstSeenAt ?? c.openedAt).getTime()) / 1000
  const alerted = (now - new Date(c.openedAt).getTime()) / 1000
  const urgent = c.status === 'needs_review' && alerted >= calloutSeconds
  const matched = orders.find((o) => o.id === c.matchedOrderId)

  if (c.status === 'matched' && matched) {
    return (
      <article className="rounded-2xl border-2 border-emerald-500 bg-white p-5 shadow-sm motion-safe:animate-case-in">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Matched · bring it out</p>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <h3 className="text-2xl font-bold text-slate-900">
            #{matched.code} · {matched.customer}
          </h3>
          <span className="text-slate-500">
            {vehicleLabel(obs)} · waiting {clock(waiting)}
          </span>
        </div>
        <p className="mt-1 text-slate-600">{matched.items.join(', ')}</p>
        <button
          disabled={busy}
          onClick={() => act({ action: 'hand_over', orderId: matched.id })}
          className="mt-4 w-full rounded-xl bg-emerald-600 py-4 text-lg font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Handed over
        </button>
      </article>
    )
  }

  const candidates = c.candidateOrderIds.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[]
  const unclear = obs?.vision.vehiclePresent === 'unclear'

  return (
    <article
      className={`rounded-2xl border-2 bg-white p-5 shadow-sm transition motion-safe:animate-case-in ${urgent ? 'border-amber-500 ring-4 ring-amber-200' : 'border-amber-300'}`}
    >
      <div className="flex gap-4">
        {obs?.frame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={obs.frame} alt="Camera frame of the pickup bay" className="h-28 w-44 flex-none rounded-lg bg-slate-200 object-cover" />
        ) : (
          <div className="flex h-28 w-44 flex-none items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
            No frame
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            {unclear ? 'Camera unsure · please check' : 'Waiting · no check-in'}
          </p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">{vehicleLabel(obs)} in the pickup bay</h3>
          <p className="mt-1 text-slate-600">
            Waiting <span className={`font-semibold tabular-nums ${urgent ? 'text-amber-700' : 'text-slate-900'}`}>{clock(waiting)}</span>
            {c.chimeAnnouncedAt && ' · announced in store'}
            {obs && <span className="text-slate-400"> · {Math.round(obs.vision.confidence * 100)}% sure</span>}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium text-slate-500">Ask the driver their name or order number, then tap their order:</p>
      <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2">
        {candidates.map((o) => (
          <li key={o.id}>
            <button
              disabled={busy}
              onClick={() => act({ action: 'confirm', caseId: c.id, orderId: o.id })}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-slate-900 hover:bg-white disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block text-lg font-semibold text-slate-900">
                  #{o.code} · {o.customer}
                </span>
                <span className="block truncate text-sm text-slate-500">{o.items.join(', ')}</span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidateReasons(o, obs, new Date(now)).map((r) => (
                    <span
                      key={r}
                      className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                        r.startsWith('Said')
                          ? 'bg-emerald-50 text-emerald-800'
                          : r.startsWith('Still preparing')
                            ? 'bg-sky-50 text-sky-800'
                            : 'bg-stone-100 text-slate-600'
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </span>
              </span>
              <span className="flex-none text-right">
                <span className="block font-semibold tabular-nums text-slate-900">{money(o.totalCents)}</span>
                <span className="block text-sm font-semibold text-slate-900 underline">This is them</span>
              </span>
            </button>
          </li>
        ))}
        {!candidates.length && <li className="text-slate-500">No ready orders left to match.</li>}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button
          disabled={busy}
          onClick={() => act({ action: 'dismiss', caseId: c.id, reason: 'not_a_customer' })}
          className="min-h-11 rounded-lg px-3 text-slate-600 hover:bg-slate-100"
        >
          Not a customer
        </button>
        <button
          disabled={busy}
          onClick={() => act({ action: 'dismiss', caseId: c.id, reason: 'already_served' })}
          className="min-h-11 rounded-lg px-3 text-slate-600 hover:bg-slate-100"
        >
          Already served
        </button>
        <button
          disabled={busy}
          onClick={() => act({ action: 'dismiss', caseId: c.id, reason: 'false_detection' })}
          className="min-h-11 rounded-lg px-3 text-slate-600 hover:bg-slate-100"
        >
          False alarm
        </button>
      </div>
    </article>
  )
}
