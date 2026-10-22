'use client'

import { useRef, useState, type PointerEvent } from 'react'
import type { Zone } from '@/lib/arrivalops/types'

interface Props {
  zone: Zone | null
  editing: boolean
  onSave: (zone: Zone) => void
  onCancel: () => void
}

const clamp = (n: number) => Math.min(1, Math.max(0, n))
const pct = (n: number) => `${n * 100}%`

/** Shows the pickup bay on top of the camera picture, and lets the owner drag out a new one. */
export function ZoneLayer({ zone, editing, onSave, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState<Zone | null>(null)

  const point = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }
  }

  const shown = editing ? draft : zone
  return (
    <div
      ref={ref}
      className={`absolute inset-0 ${editing ? 'cursor-crosshair touch-none bg-black/30' : 'pointer-events-none'}`}
      onPointerDown={(e) => {
        if (!editing) return
        e.currentTarget.setPointerCapture(e.pointerId)
        const p = point(e)
        setStart(p)
        setDraft({ ...p, w: 0, h: 0 })
      }}
      onPointerMove={(e) => {
        if (!editing || !start) return
        const p = point(e)
        setDraft({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) })
      }}
      onPointerUp={() => setStart(null)}
    >
      {shown && shown.w > 0 && (
        <div
          className="absolute rounded-md border-2 border-dashed border-amber-300 bg-amber-300/10"
          style={{ left: pct(shown.x), top: pct(shown.y), width: pct(shown.w), height: pct(shown.h) }}
        >
          <span className="absolute -top-6 left-0 rounded bg-amber-300 px-1.5 py-0.5 text-xs font-semibold text-amber-950">Pickup bay</span>
        </div>
      )}
      {editing && (
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-xl bg-black/75 px-3 py-2 text-sm text-white">
          <span>Drag a box around the pickup bay. Cars outside it are ignored.</span>
          <span className="flex flex-none gap-2">
            <button onClick={onCancel} className="min-h-11 rounded-lg px-3 hover:bg-white/10">
              Cancel
            </button>
            <button
              disabled={!draft || draft.w < 0.05 || draft.h < 0.05}
              onClick={() => draft && onSave(draft)}
              className="min-h-11 rounded-lg bg-white px-3 font-semibold text-slate-900 disabled:opacity-40"
            >
              Save bay
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
