'use client'

import { useEffect, useRef, useState } from 'react'
import { useFrameSampler } from '../../hooks/useFrameSampler'
import { useWebRTCStream } from '../../hooks/useWebRTCStream'
import type { ActionInput } from '@/lib/arrivalops/store'
import type { DeskSettings, Observation, VisionResult } from '@/lib/arrivalops/types'
import type { ReplayState } from '../../hooks/useArrivalOps'
import { friendlyCameraError } from '@/lib/arrivalops/cameraErrors'
import { ZoneLayer } from './ZoneLayer'

/** One line under the picture: what the camera last saw in the bay, and which model said so. */
function VisionStatus({ v, source, checking, idle }: { v?: VisionResult; source: string; checking?: boolean; idle: string }) {
  const text = checking
    ? 'Checking frame…'
    : !v
      ? idle
      : v.error
        ? 'Couldn’t check this frame. Still watching.'
        : v.vehiclePresent === false
          ? 'Bay clear'
          : v.vehiclePresent === 'unclear'
            ? 'Unsure, maybe a vehicle'
            : `${[v.colour, v.vehicleType].filter(Boolean).join(' ') || 'Vehicle'} · ${v.stopped === true ? 'stopped' : v.stopped === false ? 'moving' : 'stopped?'}`
  const dot = !v || checking ? 'bg-slate-500' : v.vehiclePresent === false ? 'bg-emerald-400' : 'bg-amber-400'
  return (
    <div title={v?.error} className="flex h-8 items-center gap-2 bg-slate-950 px-3 text-xs text-slate-200">
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${dot}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium first-letter:uppercase">{text}</span>
      {v && (
        <span className="flex-none text-slate-400">
          {source} · {v.model.replace(/^us\./, '')}
          {v.latencyMs ? ` · ${(v.latencyMs / 1000).toFixed(1)}s` : ''}
        </span>
      )}
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
  settings: DeskSettings
  busy: boolean
  act: (a: ActionInput) => Promise<void> | void
}

export function CameraPanel({ live, latest, replay, startReplay, stopReplay, onObserved, settings, busy, act }: Props) {
  const [editingZone, setEditingZone] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [device, setDevice] = useState<{ id: string; name: string } | null>(null)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const { streamActive, streamError, startStream, stopStream } = useWebRTCStream({ videoRef, deviceId: device?.id })
  const { last, checking } = useFrameSampler({
    videoRef,
    enabled: live && streamActive,
    deviceId: device?.id,
    deviceName: device?.name,
    zone: settings.zone,
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

  // Before anything has played, show the empty bays so the marked pickup bay has something to sit on.
  const replayFrame = latest?.source === 'replay' ? latest.frame : '/replay/lot-bays-clear.jpg'

  return (
    <section aria-label="Pickup bay camera" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex h-10 items-center gap-2 border-b border-slate-200 px-3">
        <h2 className="whitespace-nowrap text-[13px] font-semibold text-slate-900">Pickup bay camera</h2>
        <span className="hidden truncate text-xs text-slate-400 sm:inline">
          {live ? (device?.name ?? 'Ring camera') : 'Ring Playground · Vehicle stream'}
        </span>
        <span className="ml-auto flex flex-none items-center gap-1.5">
          <button
            disabled={busy || editingZone}
            onClick={() => setEditingZone(true)}
            title={settings.zone ? 'Only the marked bay is checked; cars parked elsewhere are ignored' : 'The whole picture is checked'}
            aria-label={settings.zone ? 'Edit bay' : 'Mark pickup bay'}
            className="h-7 rounded-md px-2.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 disabled:opacity-40"
          >
            {settings.zone ? 'Edit bay' : 'Mark pickup bay'}
          </button>
          {!live && (
            <button
              onClick={replay.running ? stopReplay : startReplay}
              className={`h-7 rounded-md px-2.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                replay.running ? 'text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-700'
              } ${replay.played ? '' : 'ring-2 ring-amber-400 ring-offset-1'}`}
            >
              {replay.running ? 'Stop replay' : replay.played ? 'Play again' : '▶ Play recorded arrival'}
            </button>
          )}
        </span>
      </header>
      <div className="relative aspect-video bg-slate-900">
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
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={replayFrame} alt="Ring Playground camera view of the pickup bays" className="h-full w-full object-cover" />
            <div className="absolute left-2 top-2 rounded bg-amber-400 px-1.5 py-px text-[10px] font-bold tracking-wide text-amber-950">
              REPLAY
            </div>
            {replay.note && (
              <span className="absolute left-[4.25rem] top-2 flex items-center gap-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
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
          </>
        )}
        <ZoneLayer
          zone={settings.zone}
          editing={editingZone}
          onCancel={() => setEditingZone(false)}
          onSave={async (zone) => {
            await act({ action: 'settings', zone })
            setEditingZone(false)
          }}
        />
      </div>
      {live ? (
        <VisionStatus
          v={last?.vision}
          checking={checking}
          source="Ring live"
          idle={streamActive ? 'Watching. Frames are only sent when the bay changes.' : 'Camera not started'}
        />
      ) : (
        <VisionStatus
          v={latest?.source === 'replay' ? latest.vision : undefined}
          source="Replay"
          idle={replay.played ? 'Bay clear' : 'Press Play: a car pulls into the bay and waits without checking in'}
        />
      )}
    </section>
  )
}
