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

/** Board state from the server, staff actions, the replay runner and the "car waiting" announcer. */
export function useArrivalOps({ soundOn }: { soundOn: boolean }) {
  const [view, setView] = useState<DeskView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [replay, setReplay] = useState<{ running: boolean; note: string | null }>({ running: false, note: null })
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/arrivalops', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      setView(await res.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? `Can't reach the server (${e.message}). Retrying…` : 'Offline. Retrying…')
    }
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

  const act = useCallback(async (input: ActionInput) => {
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
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const stopReplay = useCallback(() => {
    if (replayTimer.current) clearTimeout(replayTimer.current)
    setReplay({ running: false, note: null })
  }, [])

  const startReplay = useCallback(() => {
    stopReplay()
    setReplay({ running: true, note: 'Starting' })
    const run = async (step: number) => {
      const res = await fetch('/api/arrivalops/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      }).catch(() => null)
      if (!res?.ok) return setReplay({ running: false, note: null })
      const data = await res.json()
      setView((v) => (v ? { ...data.view, mode: v.mode } : v))
      if (data.nextStep === null) return setReplay({ running: false, note: data.note })
      setReplay({ running: true, note: data.note })
      replayTimer.current = setTimeout(() => run(data.nextStep), data.nextDelayMs)
    }
    run(0)
  }, [stopReplay])

  useEffect(() => stopReplay, [stopReplay])

  return { view, error, busy, act, refresh, replay, startReplay, stopReplay }
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
