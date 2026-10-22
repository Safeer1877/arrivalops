// The heart of ArrivalOps: decide whether a vehicle at the pickup bay is a customer nobody knows about,
// and walk the case from "needs review" to "handed over". Pure functions over State, so they're easy to test.

import type { ActivityEntry, DismissReason, Observation, Order, ReviewCase, State } from './types'

export const DUE_BEFORE_MIN = 20 // an order is "due" from 20 min before its pickup time...
export const DUE_AFTER_MIN = 45 // ...until 45 min after it
export const DEDUPE_WINDOW_MS = 3 * 60_000 // repeat sightings within 3 min belong to the same case
export const CHIME_AFTER_MS = 45_000 // announce on the in-store chime if nobody has acted for 45 s
export const MAX_CANDIDATES = 3

export interface Ctx {
  now: Date
  id: (prefix: string) => string
}

const iso = (d: Date) => d.toISOString()
const ms = (s: string) => new Date(s).getTime()

function strip(state: State): Omit<State, 'undo'> {
  const { undo: _undo, ...rest } = state
  return structuredClone(rest)
}

function log(state: State, ctx: Ctx, entry: Omit<ActivityEntry, 'id' | 'at'>): void {
  state.activity.unshift({ id: ctx.id('act'), at: iso(ctx.now), ...entry })
  state.activity.length = Math.min(state.activity.length, 200)
}

export function isDue(order: Order, now: Date): boolean {
  if (order.handedOverAt || order.checkIn) return false
  if (ms(order.readyAt) > now.getTime()) return false
  const delta = now.getTime() - ms(order.pickupAt)
  return delta >= -DUE_BEFORE_MIN * 60_000 && delta <= DUE_AFTER_MIN * 60_000
}

const WORDS = /[a-z]+/g

/** Rank due orders for a sighting: a matching customer-provided vehicle hint first, then pickup time. */
export function rankCandidates(orders: Order[], obs: Observation, now: Date): string[] {
  const seen = new Set([obs.vision.colour, obs.vision.vehicleType].join(' ').toLowerCase().match(WORDS) ?? [])
  return orders
    .filter((o) => isDue(o, now))
    .map((o) => {
      const hint = o.vehicleHint?.toLowerCase().match(WORDS) ?? []
      const hintScore = hint.filter((w) => seen.has(w)).length
      const minutesOff = Math.abs(now.getTime() - ms(o.pickupAt)) / 60_000
      return { id: o.id, score: hintScore * 2 + Math.max(0, 1 - minutesOff / 60) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((c) => c.id)
}

function describeVehicle(obs: Observation): string {
  const v = obs.vision
  if (v.vehiclePresent === 'unclear') return 'Possible vehicle (camera unsure)'
  const name = [v.colour, v.vehicleType].filter(Boolean).join(' ')
  return name ? name[0].toUpperCase() + name.slice(1) : 'Vehicle'
}

/** A new camera sighting. Opens or extends a review case only when an arrival can't be accounted for. */
export function observe(state: State, obs: Observation, ctx: Ctx): ReviewCase | null {
  state.observations.unshift(obs)
  state.observations.length = Math.min(state.observations.length, 100)

  if (obs.vision.error) {
    log(state, ctx, { kind: 'vision_error', text: `Couldn't analyse a frame from ${obs.deviceName ?? 'camera'}: ${obs.vision.error}` })
  }
  const waiting = obs.vision.vehiclePresent !== false && obs.vision.stopped !== false
  if (!waiting || (obs.vision.error && obs.vision.vehiclePresent !== true)) {
    log(state, ctx, { kind: 'observation', text: obs.vision.vehiclePresent === false ? 'Bay clear' : 'Vehicle passing, not stopped' })
    return null
  }

  const open = state.cases.find(
    (c) =>
      c.status === 'needs_review' &&
      c.observationIds.some((id) => {
        const o = state.observations.find((x) => x.id === id)
        return o && o.deviceId === obs.deviceId && ctx.now.getTime() - ms(o.at) <= DEDUPE_WINDOW_MS
      }),
  )
  const candidates = rankCandidates(state.orders, obs, ctx.now)

  if (open) {
    open.observationIds.unshift(obs.id)
    if (candidates.length) open.candidateOrderIds = candidates
    log(state, ctx, { kind: 'case_updated', text: `${describeVehicle(obs)} still in the bay`, caseId: open.id })
    return open
  }

  if (!candidates.length) {
    const checkedIn = state.orders.filter((o) => o.checkIn && !o.handedOverAt).length
    log(state, ctx, {
      kind: 'observation',
      text: checkedIn
        ? `${describeVehicle(obs)} in the bay; every waiting customer has already checked in`
        : `${describeVehicle(obs)} in the bay; no pickups are due`,
    })
    return null
  }

  const c: ReviewCase = {
    id: ctx.id('case'),
    observationIds: [obs.id],
    status: 'needs_review',
    candidateOrderIds: candidates,
    openedAt: iso(ctx.now),
  }
  state.cases.unshift(c)
  log(state, ctx, { kind: 'case_opened', text: `${describeVehicle(obs)} waiting with no check-in`, caseId: c.id })
  return c
}

function snapshot(state: State, label: string) {
  state.undo = { label, snapshot: strip(state) }
}

function getCase(state: State, caseId: string): ReviewCase {
  const c = state.cases.find((x) => x.id === caseId)
  if (!c) throw new ActionError(404, 'Case not found')
  return c
}

function getOrder(state: State, orderId: string): Order {
  const o = state.orders.find((x) => x.id === orderId)
  if (!o) throw new ActionError(404, 'Order not found')
  return o
}

export class ActionError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Staff confirm which order the waiting car is here for (after asking the driver, or by order code). */
export function confirmMatch(state: State, caseId: string, orderId: string, ctx: Ctx): void {
  const c = getCase(state, caseId)
  if (c.status !== 'needs_review') throw new ActionError(409, 'This case is already resolved')
  const o = getOrder(state, orderId)
  if (o.handedOverAt) throw new ActionError(409, `Order ${o.code} was already handed over`)
  snapshot(state, `Match to #${o.code}`)
  c.status = 'matched'
  c.matchedOrderId = o.id
  c.matchedAt = iso(ctx.now)
  if (!o.checkIn) o.checkIn = { at: iso(ctx.now), source: 'staff_rescue' }
  log(state, ctx, { kind: 'matched', text: `Matched to #${o.code} (${o.customer})`, caseId, orderId })
}

export function handOver(state: State, orderId: string, ctx: Ctx): void {
  const o = getOrder(state, orderId)
  if (o.handedOverAt) throw new ActionError(409, `Order ${o.code} was already handed over`)
  snapshot(state, `Hand over #${o.code}`)
  o.handedOverAt = iso(ctx.now)
  for (const c of state.cases) {
    if (c.matchedOrderId === o.id && c.status === 'matched') {
      c.status = 'handed_over'
      c.resolvedAt = iso(ctx.now)
    }
  }
  log(state, ctx, { kind: 'handed_over', text: `#${o.code} handed to ${o.customer}`, orderId })
}

export function dismiss(state: State, caseId: string, reason: DismissReason, ctx: Ctx): void {
  const c = getCase(state, caseId)
  if (c.status !== 'needs_review') throw new ActionError(409, 'This case is already resolved')
  snapshot(state, 'Dismiss')
  c.status = 'dismissed'
  c.dismissReason = reason
  c.resolvedAt = iso(ctx.now)
  log(state, ctx, { kind: 'dismissed', text: `Dismissed: ${reason.replace(/_/g, ' ')}`, caseId })
}

/** The customer checked in through the ordering system after all; take their order out of open cases. */
export function posCheckIn(state: State, orderId: string, ctx: Ctx): void {
  const o = getOrder(state, orderId)
  if (o.checkIn) return
  o.checkIn = { at: iso(ctx.now), source: 'pos' }
  log(state, ctx, { kind: 'check_in', text: `#${o.code} checked in via ordering app`, orderId })
  for (const c of state.cases) {
    if (c.status !== 'needs_review') continue
    c.candidateOrderIds = c.candidateOrderIds.filter((id) => id !== o.id)
    if (!c.candidateOrderIds.length) {
      c.status = 'dismissed'
      c.dismissReason = 'already_served'
      c.resolvedAt = iso(ctx.now)
      log(state, ctx, { kind: 'case_updated', text: 'Case closed: the customer checked in', caseId: c.id })
    }
  }
}

export function undo(state: State, ctx: Ctx): string {
  if (!state.undo) throw new ActionError(409, 'Nothing to undo')
  const { label, snapshot: prev } = state.undo
  const activity = state.activity
  Object.assign(state, prev, { undo: undefined })
  state.activity = activity
  log(state, ctx, { kind: 'undo', text: `Undid: ${label}` })
  return label
}

/** Cases nobody has acted on for a while get announced once on the in-store chime. */
export function casesToAnnounce(state: State, now: Date): ReviewCase[] {
  return state.cases.filter((c) => c.status === 'needs_review' && !c.chimeAnnouncedAt && now.getTime() - ms(c.openedAt) >= CHIME_AFTER_MS)
}
