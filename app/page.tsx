'use client'

import { useEffect, useRef, useState } from 'react'
import { AboutDemo } from './components/desk/AboutDemo'
import { Activity } from './components/desk/Activity'
import { CameraPanel } from './components/desk/CameraPanel'
import { CaseCard } from './components/desk/CaseCard'
import { DemoMenu } from './components/desk/DemoMenu'
import { Logo } from './components/desk/Logo'
import { MissedCard } from './components/desk/MissedCard'
import { PickupQueue } from './components/desk/PickupQueue'
import { StatStrip } from './components/desk/StatStrip'
import { WatchingCard } from './components/desk/WatchingCard'
import { announce, unlockAudio, useArrivalOps } from './hooks/useArrivalOps'
import type { Order, Zone } from '@/lib/arrivalops/types'

const SHOP = process.env.NEXT_PUBLIC_SHOP_NAME || 'Corner Kitchen'
const ZONE_KEY = 'arrivalops.zone'

function Panel({
  title,
  meta,
  children,
  className = '',
}: {
  title: string
  meta?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      <header className="flex h-10 flex-none items-center gap-2 border-b border-slate-200 px-4">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        {meta}
      </header>
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  )
}

export default function Desk() {
  const [soundOn, setSoundOn] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const { view, offline, notice, busy, act, refresh, replay, startReplay, stopReplay, driveOff } = useArrivalOps({ soundOn })
  const [now, setNow] = useState(() => Date.now())
  const [forceReplay, setForceReplay] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [undoToast, setUndoToast] = useState<string | null>(null)
  const lastUndo = useRef<string | null | undefined>(undefined)
  const restored = useRef(false)

  useEffect(() => {
    setForceReplay(new URLSearchParams(window.location.search).has('replay'))
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Each staff action offers Undo for a few seconds as a toast, instead of a permanent header button.
  useEffect(() => {
    if (!view) return
    const label = view.canUndo
    if (lastUndo.current === undefined) {
      lastUndo.current = label // what was undoable before this page opened isn't news
      return
    }
    if (label === lastUndo.current) return
    lastUndo.current = label
    setUndoToast(label)
    if (!label) return
    const t = setTimeout(() => setUndoToast(null), 8000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.canUndo, Boolean(view)])

  // The bay this browser saved survives a server restart: put it back quietly if the board came up without it.
  useEffect(() => {
    if (!view || restored.current) return
    restored.current = true
    try {
      const saved = JSON.parse(localStorage.getItem(ZONE_KEY) || 'null') as Zone | null
      if (saved && JSON.stringify(saved) !== JSON.stringify(view.settings.zone)) act({ action: 'settings', zone: saved, quiet: true })
    } catch {
      // storage blocked or malformed: the board's own bay stands
    }
  }, [view, act])

  if (!view) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 text-sm text-slate-500">
        <Logo size={40} />
        <p>{offline ? 'Can’t reach the pickup desk server. Retrying…' : 'Opening the pickup desk…'}</p>
      </main>
    )
  }

  const live = Boolean(view.mode?.live) && !forceReplay
  const active = view.cases.filter((c) => c.status === 'needs_review' || c.status === 'matched')
  const watching = view.cases.filter((c) => c.status === 'watching')
  const expanded = active.find((c) => c.id === expandedId && c.status === 'needs_review') ?? active.find((c) => c.status === 'needs_review')
  // A customer who gave up in the last 15 minutes stays in the queue so someone can call them.
  const missed = view.cases.find((c) => c.status === 'left' && c.resolvedAt && now - new Date(c.resolvedAt).getTime() < 15 * 60_000)
  const missedText = missed && view.activity.find((a) => a.kind === 'left' && a.caseId === missed.id)?.text
  const missedOrders = (missed?.candidateOrderIds ?? [])
    .map((id) => view.orders.find((o) => o.id === id))
    .filter((o): o is Order => Boolean(o && !o.checkIn && !o.handedOverAt))
    .slice(0, 3)
  const alertCount = active.length + (missedText ? 1 : 0)
  const toast = undoToast ? { text: `Done: ${undoToast}`, undo: true } : notice ? { text: notice, undo: false } : null

  return (
    <main className="flex min-h-screen flex-col bg-slate-100 text-slate-900 lg:h-screen lg:overflow-hidden">
      <header className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 bg-slate-900 px-4 py-2 text-white lg:h-14 lg:flex-nowrap lg:py-0">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <div className="leading-tight">
            <p className="text-sm font-semibold">ArrivalOps</p>
            <p className="text-[11px] text-slate-400">{SHOP} · pickup desk</p>
          </div>
        </div>
        <span
          title={
            live
              ? 'Video is live from the Ring camera'
              : 'Real frames from the Ring Developer Playground, played in a staged order. Orders are simulated.'
          }
          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${live ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}
        >
          {live ? '● Live · Ring camera' : 'Replay · Ring Playground frames'}
        </span>
        <div className="order-last w-full border-t border-slate-800 pt-2 lg:order-none lg:ml-6 lg:w-auto lg:flex-1 lg:border-0 lg:pt-0">
          <div className="max-w-2xl">
            <StatStrip m={view.metrics} />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => {
              const next = !soundOn
              setSoundOn(next)
              if (next) {
                unlockAudio()
                announce('Call-outs on.')
              }
            }}
            aria-pressed={soundOn}
            className={`h-8 rounded-md px-2.5 text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
              soundOn ? 'bg-white font-medium text-slate-900' : 'text-slate-200 ring-1 ring-slate-600 hover:bg-slate-800'
            }`}
          >
            {soundOn ? 'Call-outs on' : 'Call-outs off'}
          </button>
          {!live && (
            <DemoMenu
              orders={view.orders}
              settings={view.settings}
              busy={busy}
              act={act}
              canDriveOff={active.some((c) => c.status === 'needs_review') || watching.length > 0}
              onDriveOff={driveOff}
              onReset={() => {
                stopReplay()
                act({ action: 'reset' })
              }}
            />
          )}
          <button
            onClick={() => setAboutOpen(true)}
            className="h-8 rounded-md px-2.5 text-[13px] text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            About
          </button>
        </div>
      </header>
      {offline && (
        <p role="status" className="flex-none bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
          Reconnecting… the board may be a few seconds old.
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        {/* Left: the camera at the largest 16:9 size that still leaves room for the activity log on one screen. */}
        {/* On a phone the two columns dissolve so alerts can come first: alerts, camera, orders, activity. */}
        <div className="contents lg:flex lg:min-h-0 lg:min-w-0 lg:max-w-[calc((100vh-21rem)*16/9)] lg:flex-[3] lg:flex-col lg:gap-3">
          <div className="order-2 lg:order-none">
            <CameraPanel
              live={live}
              latest={view.observations[0]}
              replay={replay}
              startReplay={startReplay}
              stopReplay={stopReplay}
              onObserved={refresh}
              settings={view.settings}
              busy={busy}
              act={async (a) => {
                await act(a)
                if (a.action === 'settings' && a.zone) {
                  try {
                    localStorage.setItem(ZONE_KEY, JSON.stringify(a.zone))
                  } catch {
                    // storage blocked: the bay still lives on the board until the server restarts
                  }
                }
              }}
            />
          </div>
          <Panel title="Activity" className="order-4 min-h-[10rem] flex-1 lg:order-none">
            <Activity entries={view.activity} />
          </Panel>
        </div>

        {/* Right: what needs someone now, then the day's orders. */}
        <div className="contents lg:flex lg:min-h-0 lg:min-w-0 lg:min-w-[24rem] lg:flex-[2] lg:flex-col lg:gap-3">
          <Panel
            title="Alerts"
            className="order-1 flex-none lg:order-none lg:max-h-[62%]"
            meta={
              alertCount > 0 ? (
                <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold tabular-nums text-white">{alertCount}</span>
              ) : (
                <span className="text-xs text-slate-400">All clear</span>
              )
            }
          >
            <div className="space-y-2 p-3" aria-live="polite">
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
                  expanded={c.id === expanded?.id}
                  onExpand={() => setExpandedId(c.id)}
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
                <MissedCard
                  text={missedText}
                  orders={missedOrders}
                  obs={view.observations.find((o) => o.id === missed?.observationIds.at(-1))}
                  now={now}
                />
              )}
              {!active.length && !watching.length && !missedText && (
                <p className="px-1 py-3 text-center text-[13px] text-slate-500">
                  No cars waiting without a check-in. An alert appears here when a car stays in the bay and nobody has checked in.
                </p>
              )}
            </div>
          </Panel>
          <Panel
            title="Pickup orders"
            className="order-3 min-h-[14rem] flex-1 lg:order-none"
            meta={
              <span
                title="No point-of-sale system is connected in this build"
                className="ml-auto rounded border border-dashed border-slate-300 px-1.5 text-[11px] text-slate-500"
              >
                Simulated orders
              </span>
            }
          >
            <PickupQueue orders={view.orders} now={now} busy={busy} act={act} />
          </Panel>
        </div>
      </div>

      <footer className="flex-none truncate px-4 pb-2 pt-1.5 text-[11px] text-slate-400" title="Licence plates and faces are never read.">
        Orders and check-ins are simulated demo data.{' '}
        {live
          ? `The Ring video is checked in this browser by an on-device vehicle detector (COCO-SSD)${
              view.mode?.bedrock.state === 'active' ? `, with Amazon Bedrock (${view.mode.bedrockModel}) as a second opinion` : ''
            }.`
          : 'Replay shows real Ring Playground frames in a staged order, with the answers the on-device vehicle detector (COCO-SSD) gave for them.'}{' '}
        Licence plates and faces are never read.
      </footer>

      {toast && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-slate-900 py-2 pl-4 pr-2 text-[13px] text-white shadow-xl">
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                disabled={busy}
                onClick={() => {
                  act({ action: 'undo' })
                  setUndoToast(null)
                }}
                className="h-7 rounded-md px-2 font-semibold text-amber-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}
      <AboutDemo open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  )
}
