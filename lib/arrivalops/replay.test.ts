import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STEPS, REPLAY_DEVICE } from './replay'
import { dispatch, recordObservation } from './store'

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

  it('ends with the customer driving off if nobody comes out', () => {
    const view = play(DEFAULT_STEPS.length)
    expect(view.cases[0].status).toBe('left')
    expect(view.metrics.missedToday).toBe(1)
  })
})
