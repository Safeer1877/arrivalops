import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STEPS, DRIVE_OFF, REPLAY_DEVICE } from './replay'
import { dispatch, getState, recordObservation, restartReplay, view } from './store'

describe('replay recording', () => {
  it('ships every frame it refers to', () => {
    for (const s of DEFAULT_STEPS) expect(existsSync(join(process.cwd(), 'public', s.frame)), s.frame).toBe(true)
  })

  function play(upTo: number) {
    const t0 = Date.now()
    let clock = 0
    const ctx = (advance = 0) => ({ now: new Date(t0 + (clock += advance)), id: (p: string) => `${p}_${clock}_${Math.random()}` })
    dispatch({ action: 'reset' }, ctx(), 'replay-test')
    let last
    for (const s of DEFAULT_STEPS.slice(0, upTo)) {
      last = recordObservation(
        { ...REPLAY_DEVICE, source: 'replay', frame: s.frame },
        { latencyMs: 0, model: 'recorded', ...s.vision },
        ctx(s.delayMs),
        'replay-test',
      )
    }
    return last!.view
  }

  it('alerts staff once the car has waited, with the customer who described it first', () => {
    const view = play(3)
    const open = view.cases.filter((c) => c.status === 'needs_review')
    expect(open).toHaveLength(1)
    expect(view.orders.find((o) => o.id === open[0].candidateOrderIds[0])?.vehicleHint).toBe('grey hatchback')
  })

  it('keeps the driver waiting at the end, so the visitor decides what happens', () => {
    const view = play(DEFAULT_STEPS.length)
    expect(view.cases[0].status).toBe('needs_review')
    expect(view.metrics.missedToday).toBe(0)
  })

  it('records a missed pickup when the demo driver gives up', () => {
    play(DEFAULT_STEPS.length)
    const view = recordObservation(
      { ...REPLAY_DEVICE, source: 'replay', frame: DRIVE_OFF.frame },
      { latencyMs: 0, model: 'recorded', ...DRIVE_OFF.vision },
      { now: new Date(Date.now() + 120_000), id: (p) => `${p}_leave` },
      'replay-test',
    ).view
    expect(view.cases[0].status).toBe('left')
    expect(view.metrics.missedToday).toBe(1)
  })

  it('clears a half-played run when the replay starts again, without counting a missed pickup', () => {
    play(3)
    restartReplay({ now: new Date(Date.now() + 60_000), id: (p) => `${p}_restart` }, 'replay-test')
    const v = view(getState('replay-test'))
    expect(v.orders.find((o) => o.vehicleHint === 'grey hatchback')?.checkIn).toBeUndefined()
    expect(v.cases.filter((c) => c.status === 'needs_review' || c.status === 'watching')).toHaveLength(0)
    expect(v.metrics.missedToday).toBe(0)
  })
})
