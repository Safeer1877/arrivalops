'use client'

import { useEffect, useState } from 'react'
import { Activity } from './components/desk/Activity'
import { CameraPanel } from './components/desk/CameraPanel'
import { CaseCard } from './components/desk/CaseCard'
import { Kpis } from './components/desk/Kpis'
import { PickupQueue } from './components/desk/PickupQueue'
import { announce, useArrivalOps } from './hooks/useArrivalOps'

const SHOP = process.env.NEXT_PUBLIC_SHOP_NAME || 'Corner Kitchen'

export default function Desk() {
  const [soundOn, setSoundOn] = useState(false)
  const { view, error, busy, act, refresh, replay, startReplay, stopReplay } = useArrivalOps({ soundOn })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!view) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 text-slate-500">
        {error ?? 'Opening the pickup desk…'}
      </main>
    )
  }

  const live = Boolean(view.mode?.live)
  const active = view.cases.filter((c) => c.status === 'needs_review' || c.status === 'matched')

  return (
    <main className="min-h-screen bg-stone-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-100/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-lg font-black text-white">A</span>
            <div>
              <p className="font-bold leading-tight">ArrivalOps</p>
              <p className="text-xs leading-tight text-slate-500">{SHOP} · pickup desk</p>
            </div>
          </div>
          <span
            className={`ml-2 rounded-full px-2.5 py-1 text-xs font-semibold ${live ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
          >
            {live ? '● Live · Ring camera' : 'Replay · recorded Ring Playground session'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {view.canUndo && (
              <button disabled={busy} onClick={() => act({ action: 'undo' })} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-stone-200">
                Undo “{view.canUndo}”
              </button>
            )}
            <button
              onClick={() => {
                const next = !soundOn
                setSoundOn(next)
                if (next) announce('Sound on. I will call out cars waiting with no check-in.')
              }}
              aria-pressed={soundOn}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${soundOn ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-stone-300'}`}
            >
              {soundOn ? 'Call-outs on' : 'Turn on call-outs'}
            </button>
            {!live && (
              <button disabled={busy} onClick={() => act({ action: 'reset' })} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-stone-200">
                Reset demo
              </button>
            )}
          </div>
        </div>
        {error && <p className="bg-rose-600 px-6 py-2 text-center text-sm font-medium text-white">{error}</p>}
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-6 py-5">
        <Kpis m={view.metrics} />

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-4">
            <CameraPanel
              live={live}
              latest={view.observations[0]}
              replay={replay}
              startReplay={startReplay}
              stopReplay={stopReplay}
              onObserved={refresh}
            />
            {active.map((c) => (
              <CaseCard key={c.id} c={c} orders={view.orders} observations={view.observations} now={now} busy={busy} act={act} />
            ))}
            {!active.length && (
              <div className="rounded-2xl border border-dashed border-stone-300 px-5 py-6 text-center text-slate-500">
                No one waiting outside without a check-in.
              </div>
            )}
          </div>
          <div className="space-y-6">
            <PickupQueue orders={view.orders} now={now} busy={busy} act={act} />
            <Activity entries={view.activity} />
          </div>
        </div>

        <footer className="pb-6 text-xs text-slate-500">
          Orders and check-ins are simulated demo data. Camera frames come from the Ring Developer Playground
          {live ? ' (live)' : ' (recorded)'}; vehicle checks run on Amazon Bedrock ({view.mode?.visionModel}). No licence plates or faces are
          read.
        </footer>
      </div>
    </main>
  )
}
