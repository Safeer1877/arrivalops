'use client'

import { useEffect, useState } from 'react'
import { AboutDemo } from './components/desk/AboutDemo'
import { Activity } from './components/desk/Activity'
import { CameraPanel } from './components/desk/CameraPanel'
import { CaseCard } from './components/desk/CaseCard'
import { DemoControls } from './components/desk/DemoControls'
import { Kpis } from './components/desk/Kpis'
import { Logo } from './components/desk/Logo'
import { PickupQueue } from './components/desk/PickupQueue'
import { WatchingCard } from './components/desk/WatchingCard'
import { announce, useArrivalOps } from './hooks/useArrivalOps'

const SHOP = process.env.NEXT_PUBLIC_SHOP_NAME || 'Corner Kitchen'

export default function Desk() {
  const [soundOn, setSoundOn] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const { view, offline, notice, busy, act, refresh, replay, startReplay, stopReplay } = useArrivalOps({ soundOn })
  const [now, setNow] = useState(() => Date.now())
  const [forceReplay, setForceReplay] = useState(false)

  useEffect(() => setForceReplay(new URLSearchParams(window.location.search).has('replay')), [])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!view) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-100 text-slate-500">
        <Logo size={44} />
        <p>{offline ? 'Can’t reach the pickup desk server. Retrying…' : 'Opening the pickup desk…'}</p>
      </main>
    )
  }

  const live = Boolean(view.mode?.live) && !forceReplay
  const active = view.cases.filter((c) => c.status === 'needs_review' || c.status === 'matched')
  const watching = view.cases.filter((c) => c.status === 'watching')
  // A customer who gave up in the last 15 minutes stays visible so someone can call them.
  const missed = view.cases.find((c) => c.status === 'left' && c.resolvedAt && now - new Date(c.resolvedAt).getTime() < 15 * 60_000)
  const missedText = missed && view.activity.find((a) => a.kind === 'left' && a.caseId === missed.id)?.text

  return (
    <main className="min-h-screen bg-stone-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-100/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo />
            <div>
              <p className="font-bold leading-tight">ArrivalOps</p>
              <p className="text-xs leading-tight text-slate-500">{SHOP} · pickup desk</p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${live ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
          >
            {live ? 'Live · Ring camera' : 'Replay · real Ring Playground frames, staged'}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {view.canUndo && (
              <button
                disabled={busy}
                onClick={() => act({ action: 'undo' })}
                className="min-h-11 rounded-lg px-3 text-sm text-slate-600 hover:bg-stone-200"
              >
                Undo “{view.canUndo}”
              </button>
            )}
            <button
              onClick={() => {
                const next = !soundOn
                setSoundOn(next)
                if (next) announce('Call-outs on. I’ll say when a car is waiting with no check-in.')
              }}
              aria-pressed={soundOn}
              className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${soundOn ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-stone-300'}`}
            >
              {soundOn ? 'Call-outs on' : 'Turn on call-outs'}
            </button>
            <button onClick={() => setAboutOpen(true)} className="min-h-11 rounded-lg px-3 text-sm text-slate-600 hover:bg-stone-200">
              About<span className="hidden sm:inline"> this demo</span>
            </button>
          </div>
        </div>
        {offline && (
          <p role="status" className="bg-slate-800 px-6 py-1.5 text-center text-sm text-white">
            Reconnecting… the board below may be a few seconds old.
          </p>
        )}
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
        <Kpis m={view.metrics} />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            {/* On a phone the case card matters most, so it comes before the camera. */}
            <div className="order-2 lg:order-1">
              <CameraPanel
                live={live}
                latest={view.observations[0]}
                replay={replay}
                startReplay={startReplay}
                stopReplay={stopReplay}
                onObserved={refresh}
                settings={view.settings}
                busy={busy}
                act={act}
              />
            </div>
            <div className="order-1 space-y-4 lg:order-2" aria-live="polite">
              {active.map((c) => (
                <CaseCard
                  key={c.id}
                  c={c}
                  calloutSeconds={view.settings.calloutSeconds}
                  orders={view.orders}
                  observations={view.observations}
                  now={now}
                  busy={busy}
                  act={act}
                />
              ))}
              {watching.map((c) => (
                <WatchingCard
                  key={c.id}
                  c={c}
                  obs={view.observations.find((o) => o.id === c.observationIds[0])}
                  dwellSeconds={view.settings.dwellSeconds}
                  now={now}
                />
              ))}
              {missedText && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Missed pickup</p>
                  <p className="mt-1 font-semibold text-slate-900">{missedText}.</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Their order is still on the shelf. Check the queue for who was due and give them a call.
                  </p>
                </div>
              )}
              {!active.length && !watching.length && (
                <div className="rounded-2xl border border-dashed border-stone-300 px-5 py-6 text-center">
                  <p className="font-semibold text-slate-700">No cars waiting unnoticed</p>
                  <p className="mt-1 text-sm text-slate-500">
                    A card appears here when the camera sees a car in the bay and nobody has checked in.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <PickupQueue orders={view.orders} now={now} busy={busy} act={act} />
            <Activity entries={view.activity} />
            {!live && (
              <DemoControls
                orders={view.orders}
                settings={view.settings}
                busy={busy}
                act={act}
                onReset={() => {
                  stopReplay()
                  act({ action: 'reset' })
                }}
              />
            )}
          </div>
        </div>

        <footer className="pb-6 text-xs text-slate-500">
          Orders and check-ins are simulated demo data.{' '}
          {live
            ? `Video is live from the Ring Developer Playground and each changed frame is checked on Amazon Bedrock (${view.mode?.visionModel}).`
            : view.mode?.replayAnswersRecorded
              ? `Replay uses real Ring Developer Playground frames in a staged order, with the answers Amazon Bedrock (${view.mode?.visionModel}) gave for each frame.`
              : 'Replay uses real Ring Developer Playground frames in a staged order; the vehicle answers shown are scripted, not live model output.'}{' '}
          Licence plates and faces are never read.
        </footer>
      </div>

      {notice && (
        <div role="alert" className="fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
          <p className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">{notice}</p>
        </div>
      )}
      <AboutDemo open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  )
}
