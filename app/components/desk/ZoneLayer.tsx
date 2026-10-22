'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Zone } from '@/lib/arrivalops/types'

interface Props {
  zone: Zone | null
  editing: boolean
  onSave: (zone: Zone) => void
  onCancel: () => void
}

const clamp = (n: number) => Math.min(1, Math.max(0, n))
const pct = (n: number) => `${n * 100}%`
const MIN = 0.05

/**
 * Shows the pickup bay on top of the camera picture, and lets the owner drag out a new one. The drawing surface
 * and the toolbar are siblings: a press on Save must never start a new box, or the box collapses before it saves.
 */
export function ZoneLayer({ zone, editing, onSave, onCancel }: Props) {
  const surface = useRef<HTMLDivElement>(null)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState<Zone | null>(null)

  // Seed the draft once, when editing starts. The board polls every 2 s and hands back a fresh zone object each
  // time; re-seeding on that would snap a half-drawn box back to the saved one.
  useEffect(() => {
    if (editing) setDraft(zone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const point = (e: PointerEvent) => {
    const r = surface.current!.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }
  }

  const shown = editing ? draft : zone
  const valid = Boolean(draft && draft.w >= MIN && draft.h >= MIN)
  return (
    <>
      <div
        ref={surface}
        data-testid="zone-surface"
        className={`absolute inset-0 ${editing ? 'cursor-crosshair touch-none bg-black/25' : 'pointer-events-none'}`}
        onPointerDown={(e) => {
          if (!editing) return
          // No text selection: dragging one would scroll the clipped picture and shift the video under the bay.
          e.preventDefault()
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
            className={`absolute rounded border-2 border-dashed ${editing ? 'border-white bg-white/10' : 'border-amber-300 bg-amber-300/5'}`}
            style={{ left: pct(shown.x), top: pct(shown.y), width: pct(shown.w), height: pct(shown.h) }}
          >
            <span className="absolute left-0 top-0 whitespace-nowrap rounded-br bg-amber-300 px-1.5 py-px text-[11px] font-semibold text-amber-950">
              Pickup bay
            </span>
          </div>
        )}
      </div>
      {editing && (
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-lg bg-slate-950/85 px-3 py-1.5 text-xs text-white">
          <span>Drag across the picture to mark the pickup bay. Cars outside it are ignored.</span>
          <span className="flex flex-none gap-1.5">
            <button onClick={onCancel} className="h-8 rounded-md px-2.5 hover:bg-white/10 focus-visible:outline focus-visible:outline-2">
              Cancel
            </button>
            <button
              disabled={!valid}
              onClick={() => draft && onSave(draft)}
              className="h-8 rounded-md bg-white px-2.5 font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-40"
            >
              Save bay
            </button>
          </span>
        </div>
      )}
    </>
  )
}
