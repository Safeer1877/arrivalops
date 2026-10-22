import { describe, expect, it } from 'vitest'
import { ActionError } from './reconcile'
import { dispatch, getState, recordObservation } from './store'

const ctx = () => ({ now: new Date(), id: (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}` })
const vision = {
  vehiclePresent: true as const,
  stopped: true as const,
  colour: 'silver',
  vehicleType: 'hatchback',
  confidence: 0.9,
  model: 't',
  latencyMs: 1,
}

describe('dispatch', () => {
  it('rejects malformed actions with a 400', () => {
    expect(() => dispatch({ action: 'explode' })).toThrow(ActionError)
    try {
      dispatch({ action: 'confirm', caseId: 1 })
    } catch (e) {
      expect((e as ActionError).status).toBe(400)
    }
  })

  it('runs the whole rescue on the seeded demo shop', () => {
    dispatch({ action: 'reset' }, ctx())
    const { caseId, view } = recordObservation({ deviceId: 'cam', source: 'synthetic' }, vision, ctx())
    expect(caseId).not.toBeNull()
    expect(view.metrics.openCases).toBe(1)
    const c = getState().cases[0]
    dispatch({ action: 'confirm', caseId: c.id, orderId: c.candidateOrderIds[0] }, ctx())
    const after = dispatch({ action: 'hand_over', orderId: c.candidateOrderIds[0] }, ctx())
    expect(after.metrics.rescuedToday).toBe(1)
    expect(after.canUndo).toMatch(/Hand over/)
  })
})
