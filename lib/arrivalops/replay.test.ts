import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { answerFor, DEFAULT_STEPS, DRIVE_OFF, REPLAY_DEVICE } from './replay'
import { DEMO_SETTINGS } from './seed'
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
        answerFor(s, DEMO_SETTINGS.zone),
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
      answerFor(DRIVE_OFF, DEMO_SETTINGS.zone),
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

  it('only sees the car when the marked bay covers it', () => {
    const car = DEFAULT_STEPS[1]
    expect(answerFor(car, { x: 0.55, y: 0.49, w: 0.44, h: 0.38 }).vehiclePresent).toBe(true)
    expect(answerFor(car, { x: 0.1, y: 0.4, w: 0.3, h: 0.3 }).vehiclePresent).toBe(false)
    expect(answerFor(car, null).vehiclePresent).toBe(true)
  })

  it('answers from what the detector really found on each frame', () => {
    const car = answerFor(DEFAULT_STEPS[1], DEMO_SETTINGS.zone)
    expect(car).toMatchObject({ vehiclePresent: true, stopped: true, colour: 'grey', vehicleType: 'car' })
    expect(car.model).toMatch(/COCO-SSD.*recorded/)
    expect(car.confidence).toBeGreaterThan(0.6)
    // The cars parked at the back of the lot are seen, but they are outside the pickup bay.
    expect(answerFor(DEFAULT_STEPS[0], DEMO_SETTINGS.zone).vehiclePresent).toBe(false)
    expect(answerFor(DEFAULT_STEPS[0], null).vehiclePresent).not.toBe(false)
  })

  it('keeps the bay the visitor saved when the replay starts again', () => {
    const zone = { x: 0.1, y: 0.2, w: 0.3, h: 0.3 }
    dispatch({ action: 'settings', zone }, undefined, 'replay-zone')
    restartReplay(undefined, 'replay-zone')
    expect(getState('replay-zone').settings?.zone).toEqual(zone)
  })
})
