import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STEPS, REPLAY_DEVICE } from './replay'
import { dispatch, recordObservation } from './store'

describe('replay recording', () => {
  it('ships every frame it refers to', () => {
    for (const s of DEFAULT_STEPS) expect(existsSync(join(process.cwd(), 'public', s.frame)), s.frame).toBe(true)
  })

  it('opens exactly one case on the demo shop, with the customer who described the car first', () => {
    const t0 = Date.now()
    let clock = 0
    const ctx = () => ({ now: new Date(t0 + (clock += 4000)), id: (p: string) => `${p}_${clock}` })
    dispatch({ action: 'reset' }, ctx())
    let last
    for (const s of DEFAULT_STEPS) {
      last = recordObservation(
        { ...REPLAY_DEVICE, source: 'replay', frame: s.frame },
        { latencyMs: 0, model: 'recorded', ...s.vision },
        ctx(),
      )
    }
    const open = last!.view.cases.filter((c) => c.status === 'needs_review')
    expect(open).toHaveLength(1)
    const first = last!.view.orders.find((o) => o.id === open[0].candidateOrderIds[0])
    expect(first?.vehicleHint).toBe('silver hatchback')
  })
})
