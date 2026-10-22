'use client'

import { useEffect, useRef } from 'react'

const ROWS: Array<[string, string]> = [
  [
    'Ring Partner API: device discovery and WHEP live video from the Developer Playground',
    'Orders, customers and “I’m here” app check-ins (no POS is connected in this build)',
  ],
  [
    'Amazon Bedrock (Nova Lite) answering on frames from that video',
    'Replay mode: real frames from the Playground’s Vehicle stream, played in a staged order because the clip never shows a car pulling in and waiting. The stamps on the picture are Ring’s own: when the clip was filmed (2023) and when the Playground streamed it to us (2026). Until recorded Bedrock answers are added, the vehicle answers in replay are scripted.',
  ],
  ['Reconciliation, metrics, undo and this desk', 'The spoken call-out plays on this device, not on a Ring Chime'],
]

export function AboutDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="w-[min(40rem,calc(100vw-2rem))] rounded-2xl p-0 text-slate-900 backdrop:bg-slate-900/40"
    >
      <div className="p-6">
        <h2 className="text-xl font-bold">About this demo</h2>
        <p className="mt-2 text-slate-600">
          ArrivalOps notices a car waiting in the pickup bay when nobody checked in, and asks staff which ready order it is for. It never
          reads licence plates or faces, and it never matches a customer on its own.
        </p>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-4 font-semibold">Real</th>
              <th className="pb-2 font-semibold">Simulated, and labelled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 align-top">
            {ROWS.map(([real, sim]) => (
              <tr key={real}>
                <td className="py-2 pr-4">{real}</td>
                <td className="py-2 text-slate-600">{sim}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-sm text-slate-600">
          To try it: press <strong>Play recorded arrival</strong>, wait for the card, ask the “driver” their name, then tap their order.
        </p>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700">
            Got it
          </button>
        </div>
      </div>
    </dialog>
  )
}
