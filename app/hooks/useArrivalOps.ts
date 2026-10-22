'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Metrics } from '@/lib/arrivalops/metrics'
import type { ActionInput } from '@/lib/arrivalops/store'
import type { ActivityEntry, Observation, Order, ReviewCase } from '@/lib/arrivalops/types'

export interface DeskView {
  orders: Order[]
  cases: ReviewCase[]
  observations: Observation[]
  activity: ActivityEntry[]
  metrics: Metrics
  canUndo: string | null
  now: string
  mode?: { live: boolean; visionModel: string }
}

const POLL_MS = 2000

export interface ReplayState {
  running: boolean
  note: string | null
  step: number
  total: number
  played: boolean // at least one run finished or started, so the first-visit hint can go
}

const IDLE_REPLAY: ReplayState = { running: false, note: null, step: -1, total: 0, played: false }

/** Board state from the server, staff actions, the replay runner and the "car waiting" announcer. */
export function useArrivalOps({ soundOn }: { soundOn: boolean }) {
  const [view, setView] = useState<DeskView | null>(null)
  const [offline, setOffline] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [busy, setBusy] = useState(false)
  const [replay, setReplay] = useState<ReplayState>(IDLE_REPLAY)
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/arrivalops', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      setView(await res.json())
      setOffline(false)
    } catch {
      // keep showing the last board; the desk shows a slim "Reconnecting" bar instead
      setOffline(true)
    }
  }, [])

  const showNotice = useCallback((text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(text)
    noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(async () => {
      await refresh()
      const res = await fetch('/api/arrivalops/tick', { method: 'POST' }).catch(() => null)
      const data = res?.ok ? await res.json() : null
      if (data?.announce?.length && soundRef.current) announce()
    }, POLL_MS)
    return () => clearInterval(t)
  }, [refresh])

  const act = useCallback(
    async (input: ActionInput) => {
      setBusy(true)
      try {
        const res = await fetch('/api/arrivalops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Action failed')
        setView((v) => ({ ...data, mode: v?.mode }))
      } catch (e) {
        showNotice(e instanceof Error ? e.message : 'That didn’t go through. Try again.')
      } finally {
        setBusy(false)
      }
    },
    [showNotice],
  )

  const stopReplay = useCallback(() => {
    if (replayTimer.current) clearTimeout(replayTimer.current)
    setReplay((r) => ({ ...r, running: false, note: null, step: -1 }))
  }, [])

  const startReplay = useCallback(() => {
    stopReplay()
    setReplay((r) => ({ ...r, running: true, note: 'Starting', step: 0, played: true }))
    const run = async (step: number) => {
      const res = await fetch('/api/arrivalops/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      }).catch(() => null)
      if (!res?.ok) {
        showNotice('The recording stopped. Press Play to start it again.')
        return setReplay((r) => ({ ...r, running: false, note: null, step: -1 }))
      }
      const data = await res.json()
      setView((v) => (v ? { ...data.view, mode: v.mode } : v))
      const progress = { note: data.note, step: data.step, total: data.total }
      if (data.nextStep === null) return setReplay((r) => ({ ...r, ...progress, running: false }))
      setReplay((r) => ({ ...r, ...progress, running: true }))
      replayTimer.current = setTimeout(() => run(data.nextStep), data.nextDelayMs)
    }
    run(0)
  }, [stopReplay, showNotice])

  useEffect(() => stopReplay, [stopReplay])

  return { view, offline, notice, busy, act, refresh, replay, startReplay, stopReplay }
}

/** Two-tone chime plus a spoken line, for a counter tablet that nobody is looking at. */
export function announce(text = 'A car is waiting in the pickup bay with no check-in.') {
  try {
    const ctx = new AudioContext()
    ;[880, 660].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.28)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.28 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.28 + 0.26)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.28)
      o.stop(ctx.currentTime + i * 0.28 + 0.3)
    })
    setTimeout(() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text)), 650)
  } catch {
    // audio blocked until the user interacts; the on-screen card still shows
  }
}
