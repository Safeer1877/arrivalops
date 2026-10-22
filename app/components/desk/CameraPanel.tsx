'use client'

import { useEffect, useRef, useState } from 'react'
import { useFrameSampler } from '../../hooks/useFrameSampler'
import { useWebRTCStream } from '../../hooks/useWebRTCStream'
import type { Observation, VisionResult } from '@/lib/arrivalops/types'
import type { ReplayState } from '../../hooks/useArrivalOps'
import { friendlyCameraError } from '@/lib/arrivalops/cameraErrors'

function VisionChip({ v, source, checking }: { v?: VisionResult; source: string; checking?: boolean }) {
  if (!v) {
    return (
      <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/70 px-3 py-2 text-sm text-white">
        {checking ? 'Checking frame…' : 'Watching. Frames are only sent when the scene changes.'}
      </div>
    )
  }
  const text = checking
    ? 'Checking frame…'
    : v.error
      ? 'Couldn’t check this frame. Still watching.'
      : v.vehiclePresent === false
        ? 'Bay clear'
        : v.vehiclePresent === 'unclear'
          ? 'Unsure, maybe a vehicle'
          : `${[v.colour, v.vehicleType].filter(Boolean).join(' ') || 'Vehicle'} · ${v.stopped === true ? 'stopped' : v.stopped === false ? 'moving' : 'stopped?'}`
  return (
    <div
      title={v.error}
      className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-xl bg-black/70 px-3 py-2 text-sm text-white"
    >
      <span className="font-semibold">{text}</span>
      <span className="text-xs text-white/70">
        {source} · {v.model.replace(/^us\./, '')}
        {v.latencyMs ? ` · ${(v.latencyMs / 1000).toFixed(1)}s` : ''}
      </span>
    </div>
  )
}

interface Props {
  live: boolean
  latest?: Observation
  replay: ReplayState
  startReplay: () => void
  stopReplay: () => void
  onObserved: () => void
}

export function CameraPanel({ live, latest, replay, startReplay, stopReplay, onObserved }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [device, setDevice] = useState<{ id: string; name: string } | null>(null)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const { streamActive, streamError, startStream, stopStream } = useWebRTCStream({ videoRef, deviceId: device?.id })
  const { last, checking } = useFrameSampler({
    videoRef,
    enabled: live && streamActive,
    deviceId: device?.id,
    deviceName: device?.name,
    onResult: onObserved,
  })

  useEffect(() => {
    if (!live) return
    fetch('/api/ring/devices')
      .then((r) => r.json())
      .then((d) =>
        d.devices?.length
          ? setDevice({ id: d.devices[0].id, name: d.devices[0].name })
          : setDeviceError(friendlyCameraError(d.error || 'No Ring devices found')),
      )
      .catch((e) => setDeviceError(friendlyCameraError(e.message)))
  }, [live])

  const replayFrame = latest?.source === 'replay' ? latest.frame : undefined

  return (
    <section aria-label="Pickup bay camera" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
      <div className="relative aspect-video">
        {live ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            {!streamActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <button
                  onClick={startStream}
                  disabled={!device}
                  className="rounded-xl bg-white px-5 py-3 font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                >
                  {device ? `Watch ${device.name}` : deviceError ? 'Camera unavailable' : 'Finding your Ring camera…'}
                </button>
                {(streamError || deviceError) && (
                  <p className="max-w-sm px-4 text-sm text-rose-200">{streamError ? friendlyCameraError(streamError) : deviceError}</p>
                )}
                {(streamError || deviceError) && (
                  <a href="?replay=1" className="text-sm text-white/80 underline hover:text-white">
                    Use the recorded session instead
                  </a>
                )}
              </div>
            )}
            {streamActive && (
              <button
                onClick={stopStream}
                className="absolute right-3 top-3 rounded-lg bg-black/60 px-3 py-1 text-xs text-white hover:bg-black/80"
              >
                Stop
              </button>
            )}
            {streamActive && <VisionChip v={last?.vision} checking={checking} source="Ring live" />}
          </>
        ) : (
          <>
            {replayFrame ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={replayFrame} alt="Recorded Ring Playground frame" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-slate-300">
                <p className="font-semibold">Pickup bay · recorded Ring Playground session</p>
                <p className="text-sm text-slate-400">Press Play to watch a car arrive without checking in.</p>
              </div>
            )}
            <div className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-1 text-xs font-bold text-amber-950">REPLAY</div>
            <div className="absolute right-3 top-3 flex items-center gap-2">
              {replay.note && (
                <span className="flex items-center gap-2 rounded-lg bg-black/60 px-2 py-1 text-xs text-white">
                  {replay.total > 0 && (
                    <span className="flex gap-1" aria-label={`Step ${replay.step + 1} of ${replay.total}`}>
                      {Array.from({ length: replay.total }, (_, i) => (
                        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= replay.step ? 'bg-white' : 'bg-white/30'}`} />
                      ))}
                    </span>
                  )}
                  {replay.note}
                </span>
              )}
              <button
                onClick={replay.running ? stopReplay : startReplay}
                className={`min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100 ${
                  replay.played ? '' : 'ring-4 ring-amber-400/70 motion-safe:animate-pulse'
                }`}
              >
                {replay.running ? 'Stop' : replay.played ? 'Play again' : 'Play recorded arrival'}
              </button>
            </div>
            {!replay.played && !latest && (
              <p className="absolute right-3 top-16 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950">
                Start here: a car arrives and waits without checking in
              </p>
            )}
            {latest?.source === 'replay' && <VisionChip v={latest.vision} source="Replay" />}
          </>
        )}
      </div>
    </section>
  )
}
