'use client'

import { useState } from 'react'
import type { ActionInput } from '@/lib/arrivalops/store'
import type { DeskSettings, Order } from '@/lib/arrivalops/types'
import { clock } from './format'

interface Props {
  orders: Order[]
  settings: DeskSettings
  busy: boolean
  act: (a: ActionInput) => void
  onReset: () => void
}

/**
 * Stand-ins for the parts of a real shop this demo doesn't connect to: the ordering app's "I'm here" button
 * and a fresh lunch rush. Kept apart from the staff view so nobody mistakes them for product features.
 */
export function DemoControls({ orders, settings, busy, act, onReset }: Props) {
  const waiting = orders.filter((o) => !o.checkIn && !o.handedOverAt)
  const [orderId, setOrderId] = useState('')
  const selected = waiting.find((o) => o.id === orderId) ?? waiting[0]

  return (
    <section aria-labelledby="demo-h" className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm">
      <h2 id="demo-h" className="font-semibold text-slate-700">
        Demo controls
      </h2>
      <p className="mt-0.5 text-slate-500">These stand in for the ordering system, which this demo doesn’t connect to.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="demo-order" className="sr-only">
          Order
        </label>
        <select
          id="demo-order"
          value={selected?.id ?? ''}
          onChange={(e) => setOrderId(e.target.value)}
          disabled={!waiting.length}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2"
        >
          {waiting.map((o) => (
            <option key={o.id} value={o.id}>
              #{o.code} · {o.customer}
            </option>
          ))}
          {!waiting.length && <option>Every customer has checked in</option>}
        </select>
        <button
          disabled={busy || !selected}
          onClick={() => selected && act({ action: 'pos_check_in', orderId: selected.id })}
          className="min-h-11 rounded-lg bg-white px-3 font-semibold text-slate-700 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-50"
        >
          Customer taps “I’m here”
        </button>
      </div>

      {settings.demoTiming && (
        <p className="mt-3 text-slate-500">
          Demo timing: staff are alerted after {clock(settings.dwellSeconds)} and the tablet speaks after {clock(settings.calloutSeconds)}.
          A shop would use about 1 minute and 45 seconds.
        </p>
      )}
      <button disabled={busy} onClick={onReset} className="mt-2 min-h-11 rounded-lg px-3 text-slate-500 hover:bg-stone-200">
        Start the lunch rush again
      </button>
    </section>
  )
}
