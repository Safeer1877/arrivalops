import { beforeEach, describe, expect, it } from 'vitest'
import { computeMetrics } from './metrics'
import {
  ActionError,
  candidateReasons,
  casesToAnnounce,
  confirmMatch,
  dismiss,
  handOver,
  observe,
  posCheckIn,
  promote,
  undo,
  type Ctx,
} from './reconcile'
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
    settings: { zone: null, dwellSeconds: 0, calloutSeconds: 45, demoTiming: false },
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

describe('dwell and departures', () => {
  const sec = (s: number): Ctx => ({ now: new Date(T0.getTime() + 60_000 + s * 1000), id: (p) => `${p}_${++n}` })
  const seen = (s: number, v: Partial<Observation['vision']> = {}) => ({ ...obs(1, v), at: sec(s).now.toISOString() })

  beforeEach(() => {
    state.settings = { zone: null, dwellSeconds: 60, calloutSeconds: 45, demoTiming: false }
  })

  it('keeps a stopped car quiet until it has waited the dwell time', () => {
    const c = observe(state, seen(0), sec(0))!
    expect(c.status).toBe('watching')
    observe(state, seen(30), sec(30))
    expect(c.status).toBe('watching')
    observe(state, seen(61), sec(61))
    expect(c.status).toBe('needs_review')
    expect(state.activity[0].text).toMatch(/waiting 1:01 with no check-in/)
  })

  it('promotes on the clock too, between sightings', () => {
    const c = observe(state, seen(0), sec(0))!
    promote(state, sec(65))
    expect(c.status).toBe('needs_review')
  })

  it('logs changes, not every frame that looks the same', () => {
    const before = state.activity.length
    observe(state, seen(0), sec(0))
    promote(state, sec(61))
    for (const s of [70, 80, 90]) observe(state, seen(s), sec(s))
    observe(state, seen(100, { vehiclePresent: false }), sec(100))
    observe(state, seen(110, { vehiclePresent: false }), sec(110))
    expect(state.activity.slice(0, state.activity.length - before).map((a) => a.kind)).toEqual(['left', 'case_opened', 'observation'])
  })

  it('opens one case per visit, even if the handed-over car is still in the bay', () => {
    const c = observe(state, seen(0), sec(0))!
    promote(state, sec(61))
    state.cases[0].status = 'handed_over'
    expect(observe(state, seen(70), sec(70))).toBeNull()
    observe(state, seen(80, { vehiclePresent: false }), sec(80))
    expect(observe(state, seen(200), sec(200))?.id).not.toBe(c.id)
  })

  it('treats a car that leaves before the alert as ordinary traffic', () => {
    const c = observe(state, seen(0), sec(0))!
    observe(state, seen(20, { vehiclePresent: false }), sec(20))
    expect(c.status).toBe('passed')
    expect(computeMetrics(state, sec(20).now).missedToday).toBe(0)
  })

  it('counts a car that drives off after the alert as a lost customer', () => {
    const c = observe(state, seen(0), sec(0))!
    promote(state, sec(61))
    observe(state, seen(90, { vehiclePresent: false }), sec(90))
    expect(c.status).toBe('left')
    expect(state.activity[0].text).toBe('Silver hatchback left without pickup after waiting 1:30')
    expect(computeMetrics(state, sec(90).now).missedToday).toBe(1)
  })

  it('leaves a matched case alone when the bay clears, so staff still record the handover', () => {
    const c = observe(state, seen(0), sec(0))!
    promote(state, sec(61))
    confirmMatch(state, c.id, 'o1047', sec(70))
    observe(state, seen(80, { vehiclePresent: false }), sec(80))
    expect(c.status).toBe('matched')
  })
})

describe('candidates', () => {
  it('include orders still being prepared, and say why each is listed', () => {
    state.orders.push(order('o1060', 8, { readyAt: at(4).toISOString() }))
    const c = observe(state, obs(1), ctx(1))!
    expect(c.candidateOrderIds).toContain('o1060')
    const o1060 = state.orders.find((o) => o.id === 'o1060')!
    expect(candidateReasons(o1060, undefined, at(1))).toEqual(['Due in 7 min', 'Still preparing, ready in 3 min'])
    const o1047 = state.orders.find((o) => o.id === 'o1047')!
    expect(candidateReasons(o1047, state.observations[0], at(1))[0]).toBe('Said “Silver hatchback”')
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
