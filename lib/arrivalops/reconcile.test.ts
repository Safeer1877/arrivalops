import { beforeEach, describe, expect, it } from 'vitest'
import { computeMetrics } from './metrics'
import { ActionError, casesToAnnounce, confirmMatch, dismiss, handOver, observe, posCheckIn, undo, type Ctx } from './reconcile'
import type { Observation, Order, State } from './types'

const T0 = new Date('2026-10-22T12:30:00Z')
const at = (min: number) => new Date(T0.getTime() + min * 60_000)

function order(id: string, pickupMin: number, extra: Partial<Order> = {}): Order {
  return {
    id,
    code: id.replace('o', ''),
    customer: `Customer ${id}`,
    items: ['Item'],
    totalCents: 2500,
    readyAt: at(pickupMin - 10).toISOString(),
    pickupAt: at(pickupMin).toISOString(),
    ...extra,
  }
}

let n = 0
const ctx = (min: number): Ctx => ({ now: at(min), id: (p) => `${p}_${++n}` })

function obs(min: number, vision: Partial<Observation['vision']> = {}, deviceId = 'cam1'): Observation {
  return {
    id: `obs_${++n}`,
    at: at(min).toISOString(),
    source: 'synthetic',
    deviceId,
    vision: {
      vehiclePresent: true,
      stopped: true,
      colour: 'silver',
      vehicleType: 'hatchback',
      confidence: 0.9,
      model: 'test',
      latencyMs: 5,
      ...vision,
    },
  }
}

let state: State
beforeEach(() => {
  n = 0
  state = {
    orders: [order('o1042', 0), order('o1047', 5, { vehicleHint: 'Silver hatchback' }), order('o1050', 90)],
    observations: [],
    cases: [],
    activity: [],
  }
})

describe('observe', () => {
  it('opens a case with due orders only, customer vehicle hint first', () => {
    const c = observe(state, obs(1), ctx(1))!
    expect(c.status).toBe('needs_review')
    expect(c.candidateOrderIds).toEqual(['o1047', 'o1042']) // o1050 is 90 min away and not ready
  })

  it('treats grey, gray and silver as the same colour when ranking', () => {
    const c = observe(state, obs(1, { colour: 'gray' }), ctx(1))!
    expect(c.candidateOrderIds[0]).toBe('o1047')
  })

  it('does nothing when the bay is empty or the car is passing', () => {
    expect(observe(state, obs(1, { vehiclePresent: false }), ctx(1))).toBeNull()
    expect(observe(state, obs(1, { stopped: false }), ctx(1))).toBeNull()
    expect(state.cases).toHaveLength(0)
  })

  it('does not open a case when every waiting customer already checked in', () => {
    posCheckIn(state, 'o1042', ctx(0))
    posCheckIn(state, 'o1047', ctx(0))
    expect(observe(state, obs(1), ctx(1))).toBeNull()
    expect(state.activity[0].text).toMatch(/already checked in/)
  })

  it('folds repeat sightings from the same camera into one case', () => {
    const a = observe(state, obs(1), ctx(1))!
    const b = observe(state, obs(2), ctx(2))!
    expect(b.id).toBe(a.id)
    expect(state.cases).toHaveLength(1)
    const c = observe(state, obs(10), ctx(10))!
    expect(c.id).not.toBe(a.id)
  })

  it('keeps an unclear sighting for review but never invents a vehicle on a failed call', () => {
    expect(observe(state, obs(1, { vehiclePresent: 'unclear', stopped: 'unclear' }), ctx(1))).not.toBeNull()
    state.cases = []
    expect(observe(state, obs(5, { vehiclePresent: 'unclear', error: 'timeout' }), ctx(5))).toBeNull()
    expect(state.activity.some((a) => a.kind === 'vision_error')).toBe(true)
  })
})

describe('staff workflow', () => {
  it('match, hand over, and measure', () => {
    const c = observe(state, obs(1), ctx(1))!
    confirmMatch(state, c.id, 'o1047', ctx(2))
    expect(state.orders[1].checkIn?.source).toBe('staff_rescue')
    handOver(state, 'o1047', ctx(4))
    expect(state.cases[0].status).toBe('handed_over')
    const m = computeMetrics(state, at(4))
    expect(m.rescuedToday).toBe(1)
    expect(m.medianSecondsToAcknowledge).toBe(60)
    expect(m.medianSecondsArrivalToHandover).toBe(180)
  })

  it('rejects double resolution and unknown ids', () => {
    const c = observe(state, obs(1), ctx(1))!
    dismiss(state, c.id, 'not_a_customer', ctx(2))
    expect(() => confirmMatch(state, c.id, 'o1042', ctx(3))).toThrow(ActionError)
    expect(() => handOver(state, 'nope', ctx(3))).toThrow(/not found/)
  })

  it('undo restores the previous state', () => {
    const c = observe(state, obs(1), ctx(1))!
    confirmMatch(state, c.id, 'o1042', ctx(2))
    expect(undo(state, ctx(3))).toBe('Match to #1042')
    expect(state.cases[0].status).toBe('needs_review')
    expect(state.orders[0].checkIn).toBeUndefined()
    expect(() => undo(state, ctx(3))).toThrow(/Nothing to undo/)
  })

  it('a late app check-in closes the case it explains', () => {
    const c = observe(state, obs(1), ctx(1))!
    posCheckIn(state, 'o1042', ctx(2))
    posCheckIn(state, 'o1047', ctx(2))
    expect(state.cases.find((x) => x.id === c.id)?.status).toBe('dismissed')
  })

  it('announces on the chime only after 45 s without action', () => {
    observe(state, obs(1), ctx(1))
    expect(casesToAnnounce(state, new Date(at(1).getTime() + 30_000))).toHaveLength(0)
    expect(casesToAnnounce(state, new Date(at(1).getTime() + 46_000))).toHaveLength(1)
  })
})

describe('metrics', () => {
  it('counts money on the shelf for overdue, unclaimed orders only', () => {
    const m = computeMetrics(state, at(10))
    expect(m.ordersAtRisk).toBe(2)
    expect(m.valueAtRiskCents).toBe(5000)
    handOver(state, 'o1042', ctx(10))
    expect(computeMetrics(state, at(10)).valueAtRiskCents).toBe(2500)
  })
})
