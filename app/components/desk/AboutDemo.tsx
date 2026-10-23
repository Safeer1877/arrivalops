'use client'

import { useEffect, useRef } from 'react'

const ROWS: Array<[string, string]> = [
  [
    'Ring video',
    'Device discovery and WHEP live streaming were tested with the Ring Developer Playground on a local Mac. This hosted demo uses recorded frames, not a live camera connection.',
  ],
  [
    'Vehicle detection',
    'COCO-SSD runs in the browser during live sessions. The replay uses saved detection results from the same model on the recorded Ring frames.',
  ],
  [
    'Amazon Bedrock',
    'Optional second opinion when configured for live mode. Testing used Gemma 3 12B through the Bedrock API-key endpoint. The public replay does not make Bedrock requests.',
  ],
  [
    'Orders and arrivals',
    'Customer details, pickup orders, check-ins, and the timing of the replayed arrival are simulated. No restaurant point-of-sale system or vehicle-arrival webhook is connected.',
  ],
  [
    'Pickup workflow',
    "Candidate ranking, exception handling, staff verification, undo, and metrics use the application's real reconciliation logic. Spoken call-outs play on the staff device, not a Ring Chime.",
  ],
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
      className="max-h-[85vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl p-0 text-slate-900 backdrop:bg-slate-900/40"
    >
      <div className="p-6">
        <h2 className="text-xl font-bold">About this demo</h2>
        <p className="mt-2 text-slate-600">
          ArrivalOps reviews possible pickup arrivals when customers have not checked in. It never identifies a driver from the camera,
          reads licence plates or faces, or automatically assigns an order.
        </p>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-4 font-semibold">Component</th>
              <th className="pb-2 font-semibold">What this demo shows</th>
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
