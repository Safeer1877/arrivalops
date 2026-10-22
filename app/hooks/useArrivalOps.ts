'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { browserFetch } from '@/lib/arrivalops/browserApi'
import type { Metrics } from '@/lib/arrivalops/metrics'
import type { ActionInput } from '@/lib/arrivalops/store'
import type { ActivityEntry, DeskSettings, Observation, Order, ReviewCase } from '@/lib/arrivalops/types'

export interface DeskView {
  orders: Order[]
  cases: ReviewCase[]
  observations: Observation[]
  activity: ActivityEntry[]
  metrics: Metrics
  settings: DeskSettings
  canUndo: string | null
  now: string
  mode?: {
    live: boolean
    detectorModel: string
    bedrockModel: string
    bedrock: { state: 'off' } | { state: 'active' } | { state: 'unavailable'; error: string }
  }
}

const POLL_MS = 2000

// The hosted demo (set at build time, automatically on Vercel) runs the desk's API in the browser, so each
// visitor has a private board and no server keeps state. Everywhere else the Next.js routes answer.
const api = process.env.NEXT_PUBLIC_ARRIVALOPS_IN_BROWSER === '1' ? browserFetch : (path: string, init?: RequestInit) => fetch(path, init)

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
      const res = await api('/api/arrivalops', { cache: 'no-store' })
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
      const res = await api(`/api/arrivalops/tick${soundRef.current ? '?speak=1' : ''}`, { method: 'POST' }).catch(() => null)
      const data = res?.ok ? await res.json() : null
      if (data?.announce?.length) {
        announce()
        showNotice('Called out: a car is waiting in the bay with no check-in')
      }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [refresh, showNotice])

  const act = useCallback(
    async (input: ActionInput) => {
      setBusy(true)
      try {
        const res = await api('/api/arrivalops', {
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
      const res = await api('/api/arrivalops/replay', {
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

  /** Demo control: the driver in the bay gives up and drives off. */
  const driveOff = useCallback(async () => {
    stopReplay()
    const res = await api('/api/arrivalops/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'leave' }),
    }).catch(() => null)
    if (!res?.ok) return showNotice('That didn’t go through. Try again.')
    const data = await res.json()
    setView((v) => (v ? { ...data.view, mode: v.mode } : v))
    setReplay((r) => ({ ...r, note: data.note, step: data.step, total: data.total }))
  }, [stopReplay, showNotice])

  return { view, offline, notice, busy, act, refresh, replay, startReplay, stopReplay, driveOff }
}

/** Two-tone chime plus a spoken line, for a counter tablet that nobody is looking at. */
let audio: AudioContext | null = null
const speaking: SpeechSynthesisUtterance[] = [] // held until they finish: Chrome can drop an utterance it has garbage-collected

/**
 * Browsers only allow sound after the person has clicked something. Call this from the call-outs toggle so the
 * audio context and speech engine are unlocked by that click, and later call-outs can play without one.
 */
export function unlockAudio() {
  try {
    audio ??= new AudioContext()
    void audio.resume()
    window.speechSynthesis?.resume()
  } catch {
    // no Web Audio: speech alone still works
  }
}

/** Two-note chime, then the spoken call-out. Speech is queued, so overlapping call-outs play in turn. */
export function announce(text = 'A car is waiting in the pickup bay with no check-in.') {
  try {
    if (audio?.state === 'running') {
      const t0 = audio.currentTime
      ;[880, 660].forEach((f, i) => {
        const o = audio!.createOscillator()
        const g = audio!.createGain()
        o.frequency.value = f
        g.gain.setValueAtTime(0.0001, t0 + i * 0.28)
        g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.28 + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.26)
        o.connect(g).connect(audio!.destination)
        o.start(t0 + i * 0.28)
        o.stop(t0 + i * 0.28 + 0.3)
      })
    }
  } catch {
    // chime is a nicety; the spoken line below is what matters
  }
  const synth = window.speechSynthesis
  if (!synth) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.onend = u.onerror = () => speaking.splice(speaking.indexOf(u), 1)
  speaking.push(u)
  setTimeout(() => {
    synth.resume() // Chrome on macOS can leave the queue paused after the tab was in the background
    synth.speak(u)
  }, 650)
}
