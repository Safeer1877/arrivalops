'use client'

import { useEffect, useRef, useState } from 'react'
import { SHOP_SETTINGS } from '@/lib/arrivalops/reconcile'
import type { ActionInput } from '@/lib/arrivalops/store'
import type { DeskSettings, Order } from '@/lib/arrivalops/types'

interface Props {
  orders: Order[]
  settings: DeskSettings
  busy: boolean
  act: (a: ActionInput) => void
  canDriveOff: boolean
  onDriveOff: () => void
  onReset: () => void
}

const ITEM =
  'flex h-8 w-full items-center rounded-md px-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 disabled:text-slate-300 disabled:hover:bg-transparent'

/**
 * Stand-ins for the parts of a real shop this demo doesn't connect to: the ordering app's "I'm here" button,
 * a driver who gives up, and a fresh lunch rush. Kept in a menu so nobody mistakes them for staff features.
 */
export function DemoMenu({ orders, settings, busy, act, canDriveOff, onDriveOff, onReset }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const waiting = orders.filter((o) => !o.checkIn && !o.handedOverAt)
  const [orderId, setOrderId] = useState('')
  // Default to a customer who didn't describe their car, so one tap doesn't spoil the replay's match.
  const selected = waiting.find((o) => o.id === orderId) ?? waiting.find((o) => !o.vehicleHint) ?? waiting[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const run = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="h-8 rounded-md border border-dashed border-slate-500 px-2.5 text-[13px] text-slate-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Demo controls
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-2 text-slate-900 shadow-xl">
          <p className="px-2.5 pb-2 pt-1 text-xs text-slate-500">
            These stand in for the ordering system, which this demo doesn’t connect to.
          </p>
          <div className="flex gap-1.5 px-1 pb-1.5">
            <label htmlFor="demo-order" className="sr-only">
              Order
            </label>
            <select
              id="demo-order"
              value={selected?.id ?? ''}
              onChange={(e) => setOrderId(e.target.value)}
              disabled={!waiting.length}
              className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-1.5 text-[13px]"
            >
              {waiting.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.code} {o.customer}
                </option>
              ))}
              {!waiting.length && <option>Everyone has checked in</option>}
            </select>
            <button
              disabled={busy || !selected}
              onClick={() => selected && run(() => act({ action: 'pos_check_in', orderId: selected.id }))}
              className="h-8 flex-none rounded-md bg-slate-900 px-2.5 text-[13px] font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              Taps “I’m here”
            </button>
          </div>
          <div className="border-t border-slate-100 pt-1">
            <button disabled={busy || !canDriveOff} onClick={() => run(onDriveOff)} className={ITEM}>
              Driver in the bay gives up and leaves
            </button>
            <button disabled={busy} onClick={() => run(onReset)} className={ITEM}>
              Start the lunch rush again
            </button>
          </div>
          {settings.demoTiming && (
            <p className="mt-1 border-t border-slate-100 px-2.5 pt-2 text-[11px] leading-relaxed text-slate-500">
              Demo timing: staff are alerted after a car has waited {settings.dwellSeconds} s, and the tablet speaks{' '}
              {settings.calloutSeconds} s after that. In a real shop: {SHOP_SETTINGS.dwellSeconds} s, then another{' '}
              {SHOP_SETTINGS.calloutSeconds} s.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
