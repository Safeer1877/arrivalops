'use client'

import { useEffect, useRef } from 'react'
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
  expanded: boolean
  onExpand: () => void
}

export function vehicleLabel(o?: Observation) {
  if (!o) return 'Vehicle'
  const v = o.vision
  if (v.vehiclePresent === 'unclear') return 'Possible vehicle'
  const name = [v.colour, v.vehicleType].filter(Boolean).join(' ')
  return name ? name[0].toUpperCase() + name.slice(1) : 'Vehicle'
}

const REASON_TONE = (r: string) =>
  r.startsWith('Said')
    ? 'bg-emerald-50 text-emerald-700'
    : r.startsWith('Still preparing')
      ? 'bg-sky-50 text-sky-700'
      : 'bg-slate-100 text-slate-600'

/** One alert in the queue: collapsed to a single line, or expanded with the orders it could be. */
export function CaseCard({ c, calloutSeconds, orders, observations, now, busy, act, expanded, onExpand }: Props) {
  const ref = useRef<HTMLElement>(null)
  // A new alert scrolls into view inside the alerts panel if staff had scrolled away.
  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and React would call it as a cleanup.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [c.id])

  const obs = observations.find((o) => o.id === c.observationIds[0])
  const waiting = (now - new Date(c.firstSeenAt ?? c.openedAt).getTime()) / 1000
  const alerted = (now - new Date(c.openedAt).getTime()) / 1000
  const urgent = c.status === 'needs_review' && alerted >= calloutSeconds
  const matched = orders.find((o) => o.id === c.matchedOrderId)
  const candidates = c.candidateOrderIds.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[]

  if (c.status === 'matched' && matched) {
    return (
      <article ref={ref} className="rounded-lg border border-emerald-300 bg-emerald-50/40 p-3 motion-safe:animate-case-in">
        <div className="flex items-center gap-2">
          <span className="rounded bg-emerald-600 px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide text-white">
            Staff confirmed
          </span>
          <span className="text-xs text-slate-500">
            {vehicleLabel(obs)} · waiting {clock(waiting)}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">
          Bring out #{matched.code} for {matched.customer}
        </p>
        <p className="truncate text-xs text-slate-500">
          {matched.items.join(', ')} · {money(matched.totalCents)}
        </p>
        <button
          disabled={busy}
          onClick={() => act({ action: 'hand_over', orderId: matched.id })}
          className="mt-2.5 h-9 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50"
        >
          Handed over
        </button>
      </article>
    )
  }

  const unclear = obs?.vision.vehiclePresent === 'unclear'
  const border = urgent ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-300'

  if (!expanded) {
    return (
      <article ref={ref}>
        <button
          onClick={onExpand}
          className={`flex w-full items-center gap-3 rounded-lg border bg-white px-3 py-2 text-left hover:bg-amber-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 ${border}`}
        >
          <span className="h-2 w-2 flex-none rounded-full bg-amber-500" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{vehicleLabel(obs)} in the bay</span>
          <span className="text-xs tabular-nums text-amber-700">{clock(waiting)}</span>
          <span className="text-xs text-slate-400">Show</span>
        </button>
      </article>
    )
  }

  return (
    <article ref={ref} className={`rounded-lg border bg-white p-3 motion-safe:animate-case-in ${border}`}>
      <div className="flex gap-3">
        {obs?.frame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={obs.frame} alt="Camera frame of the pickup bay" className="h-[60px] w-[106px] flex-none rounded object-cover" />
        ) : (
          <div className="flex h-[60px] w-[106px] flex-none items-center justify-center rounded bg-slate-100 text-[11px] text-slate-400">
            No frame
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            {unclear ? 'Camera unsure · please check' : 'Waiting · no check-in'}
          </p>
          <h3 className="truncate text-[15px] font-semibold leading-snug text-slate-900">{vehicleLabel(obs)} in the pickup bay</h3>
          <p className="text-xs text-slate-500">
            Waiting <span className={`font-semibold tabular-nums ${urgent ? 'text-amber-700' : 'text-slate-900'}`}>{clock(waiting)}</span>
            {c.chimeAnnouncedAt && ' · called out on the tablet'}
            {obs && ` · ${Math.round(obs.vision.confidence * 100)}% sure`}
          </p>
        </div>
      </div>

      <p className="mt-2.5 text-xs text-slate-500">Ask the driver their name or order number, then pick their order:</p>
      <ul className="mt-1.5 space-y-1.5">
        {candidates.map((o, i) => (
          <li key={o.id}>
            <button
              disabled={busy}
              onClick={() => act({ action: 'confirm', caseId: c.id, orderId: o.id })}
              className={`group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left hover:border-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 disabled:opacity-50 ${
                i === 0 ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    #{o.code} {o.customer}
                  </span>
                  <span className="flex-none text-xs tabular-nums text-slate-500">{money(o.totalCents)}</span>
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {candidateReasons(o, obs, new Date(now)).map((r) => (
                    <span key={r} className={`rounded px-1.5 py-px text-[11px] font-medium ${REASON_TONE(r)}`}>
                      {r}
                    </span>
                  ))}
                </span>
              </span>
              <span className="flex-none rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white opacity-90 group-hover:opacity-100">
                This is them
              </span>
            </button>
          </li>
        ))}
        {!candidates.length && <li className="text-xs text-slate-500">No ready orders left to match.</li>}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
        <span className="mr-1 text-slate-400">Not a pickup?</span>
        {(
          [
            ['not_a_customer', 'Not a customer'],
            ['already_served', 'Already served'],
            ['false_detection', 'False alarm'],
          ] as const
        ).map(([reason, label]) => (
          <button
            key={reason}
            disabled={busy}
            onClick={() => act({ action: 'dismiss', caseId: c.id, reason })}
            className="h-7 rounded px-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            {label}
          </button>
        ))}
      </div>
    </article>
  )
}
