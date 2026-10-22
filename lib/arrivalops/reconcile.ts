// The heart of ArrivalOps: decide whether a vehicle at the pickup bay is a customer nobody knows about,
// and walk the case from "needs review" to "handed over". Pure functions over State, so they're easy to test.

import type { ActivityEntry, DeskSettings, DismissReason, Observation, Order, ReviewCase, State } from './types'

export const DUE_BEFORE_MIN = 20 // an order is "due" from 20 min before its pickup time...
export const DUE_AFTER_MIN = 45 // ...until 45 min after it
export const DEDUPE_WINDOW_MS = 3 * 60_000 // repeat sightings within 3 min belong to the same case
export const MAX_CANDIDATES = 3

// A shop's defaults. 60 s keeps drive-throughs and drop-offs from ever reaching staff; 45 s is about as long
// as a tablet alert can sit unseen during a rush before someone should hear it.
export const SHOP_SETTINGS: DeskSettings = { zone: null, dwellSeconds: 60, calloutSeconds: 45, demoTiming: false }

export const settingsOf = (state: State): DeskSettings => state.settings ?? SHOP_SETTINGS

const OPEN: ReviewCase['status'][] = ['watching', 'needs_review']

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

/** Could a car arriving now be here for this order? Includes orders still being prepared. */
export function isCandidate(order: Order, now: Date): boolean {
  if (order.handedOverAt || order.checkIn) return false
  const delta = now.getTime() - ms(order.pickupAt)
  return delta >= -DUE_BEFORE_MIN * 60_000 && delta <= DUE_AFTER_MIN * 60_000
}

/** A candidate that is also ready on the shelf. */
export function isDue(order: Order, now: Date): boolean {
  return isCandidate(order, now) && ms(order.readyAt) <= now.getTime()
}

const WORDS = /[a-z]+/g

// People and models name the same car colour differently; treat these as one.
const SAME_COLOUR: Record<string, string> = { gray: 'grey', silver: 'grey' }
const words = (s: string) => (s.toLowerCase().match(WORDS) ?? []).map((w) => SAME_COLOUR[w] ?? w)

/** Rank due orders for a sighting: a matching customer-provided vehicle hint first, then pickup time. */
export function rankCandidates(orders: Order[], obs: Observation, now: Date): string[] {
  const seen = new Set(words([obs.vision.colour, obs.vision.vehicleType].join(' ')))
  return orders
    .filter((o) => isCandidate(o, now))
    .map((o) => {
      const hint = o.vehicleHint ? words(o.vehicleHint) : []
      const hintScore = hint.filter((w) => seen.has(w)).length
      const minutesOff = Math.abs(now.getTime() - ms(o.pickupAt)) / 60_000
      return { id: o.id, score: hintScore * 2 + Math.max(0, 1 - minutesOff / 60) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((c) => c.id)
}

/** Why an order is on a case's shortlist, in the words staff would use. */
export function candidateReasons(order: Order, obs: Observation | undefined, now: Date): string[] {
  const reasons: string[] = []
  if (obs && order.vehicleHint) {
    const seen = new Set(words([obs.vision.colour, obs.vision.vehicleType].join(' ')))
    if (words(order.vehicleHint).some((w) => seen.has(w))) reasons.push(`Said “${order.vehicleHint}”`)
  }
  const mins = Math.round((now.getTime() - ms(order.pickupAt)) / 60_000)
  reasons.push(mins > 0 ? `Due ${mins} min ago` : mins === 0 ? 'Due now' : `Due in ${-mins} min`)
  const readyIn = Math.ceil((ms(order.readyAt) - now.getTime()) / 60_000)
  if (readyIn > 0) reasons.push(`Still preparing, ready in ${readyIn} min`)
  return reasons
}

function describeVehicle(obs: Observation): string {
  const v = obs.vision
  if (v.vehiclePresent === 'unclear') return 'Possible vehicle (camera unsure)'
  const name = [v.colour, v.vehicleType].filter(Boolean).join(' ')
  return name ? name[0].toUpperCase() + name.slice(1) : 'Vehicle'
}

function vehicleOf(state: State, c: ReviewCase): string {
  const first = state.observations.find((o) => o.id === c.observationIds[c.observationIds.length - 1])
  return first ? describeVehicle(first) : 'Car'
}

const sinceSeconds = (iso: string, now: Date) => Math.round((now.getTime() - ms(iso)) / 1000)

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** The open case for this camera, if its last sighting is recent enough to be the same visit. */
function activeCase(state: State, obs: Observation, now: Date): ReviewCase | undefined {
  return state.cases.find(
    (c) =>
      OPEN.includes(c.status) &&
      c.observationIds.some((id) => {
        const o = state.observations.find((x) => x.id === id)
        return o && o.deviceId === obs.deviceId && now.getTime() - ms(o.at) <= DEDUPE_WINDOW_MS
      }),
  )
}

function sameVisitHandled(state: State, obs: Observation): boolean {
  const lastClear = state.observations.find(
    (o) => o.id !== obs.id && o.deviceId === obs.deviceId && o.vision.vehiclePresent === false && !o.vision.error,
  )
  const since = lastClear ? ms(lastClear.at) : 0
  return state.cases.some(
    (c) =>
      !OPEN.includes(c.status) &&
      ms(c.firstSeenAt) >= since &&
      c.observationIds.some((id) => state.observations.find((o) => o.id === id)?.deviceId === obs.deviceId),
  )
}

/** Alert staff about cars that have now been stopped in the bay for the dwell time. */
export function promote(state: State, ctx: Ctx): ReviewCase[] {
  const { dwellSeconds } = settingsOf(state)
  const promoted = state.cases.filter((c) => c.status === 'watching' && sinceSeconds(c.firstSeenAt, ctx.now) >= dwellSeconds)
  for (const c of promoted) {
    c.status = 'needs_review'
    c.openedAt = iso(ctx.now)
    const obs = state.observations.find((o) => o.id === c.observationIds[0])
    log(state, ctx, {
      kind: 'case_opened',
      text: `${obs ? describeVehicle(obs) : 'Vehicle'} waiting ${clock(sinceSeconds(c.firstSeenAt, ctx.now))} with no check-in`,
      caseId: c.id,
    })
  }
  return promoted
}

/** Closes open sightings without counting a lost customer, e.g. when a demo replay is restarted part way. */
export function closeOpenSightings(state: State, ctx: Ctx, reason: string): number {
  const open = state.cases.filter((c) => OPEN.includes(c.status))
  for (const c of open) {
    c.status = 'passed'
    c.resolvedAt = iso(ctx.now)
  }
  if (open.length) log(state, ctx, { kind: 'observation', text: reason })
  return open.length
}

/**
 * A new camera sighting of the pickup bay. A car that stops starts a quiet "watching" case; it reaches staff
 * only after the dwell time, and only while some due order has no check-in. A clear bay ends the visit,
 * which counts as a lost customer if staff had been alerted and never came out.
 */
export function observe(state: State, obs: Observation, ctx: Ctx): ReviewCase | null {
  state.observations.unshift(obs)
  state.observations.length = Math.min(state.observations.length, 100)

  if (obs.vision.error) {
    log(state, ctx, { kind: 'vision_error', text: `Couldn't analyse a frame from ${obs.deviceName ?? 'camera'}: ${obs.vision.error}` })
  }
  const open = activeCase(state, obs, ctx.now)
  // Only changes are logged; a camera that keeps seeing the same thing shouldn't bury the activity feed.
  const previous = state.observations[1]
  const wasClear = previous?.vision.vehiclePresent === false && !previous.vision.error

  if (obs.vision.vehiclePresent === false && !obs.vision.error) {
    if (open?.status === 'needs_review') {
      open.status = 'left'
      open.resolvedAt = iso(ctx.now)
      log(state, ctx, {
        kind: 'left',
        text: `${vehicleOf(state, open)} left without pickup after waiting ${clock(sinceSeconds(open.firstSeenAt, ctx.now))}`,
        caseId: open.id,
      })
    } else if (open) {
      open.status = 'passed'
      open.resolvedAt = iso(ctx.now)
      log(state, ctx, { kind: 'observation', text: 'Car left the bay before an alert was needed' })
    } else if (!wasClear) {
      log(state, ctx, { kind: 'observation', text: 'Bay clear' })
    }
    return null
  }

  const waiting = obs.vision.vehiclePresent !== false && obs.vision.stopped !== false
  if (!waiting || (obs.vision.error && obs.vision.vehiclePresent !== true)) {
    if (!obs.vision.error) log(state, ctx, { kind: 'observation', text: 'Vehicle passing, not stopped' })
    return null
  }

  const candidates = rankCandidates(state.orders, obs, ctx.now)

  // One case per visit: once staff have dealt with this car, more frames of it sitting there change nothing
  // until the bay has been seen clear again.
  if (!open && sameVisitHandled(state, obs)) return null

  if (open) {
    open.observationIds.unshift(obs.id)
    if (candidates.length) open.candidateOrderIds = candidates
    promote(state, ctx)
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
    status: 'watching',
    candidateOrderIds: candidates,
    firstSeenAt: iso(ctx.now),
    openedAt: iso(ctx.now),
  }
  state.cases.unshift(c)
  log(state, ctx, { kind: 'observation', text: `${describeVehicle(obs)} stopped in the bay` })
  promote(state, ctx)
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
    if (!OPEN.includes(c.status)) continue
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

/** Alerts nobody has acted on for a while get announced once, out loud, on the counter tablet. */
export function casesToAnnounce(state: State, now: Date): ReviewCase[] {
  const { calloutSeconds } = settingsOf(state)
  return state.cases.filter(
    (c) => c.status === 'needs_review' && !c.chimeAnnouncedAt && now.getTime() - ms(c.openedAt) >= calloutSeconds * 1000,
  )
}

/** The owner marks the pickup bay on the camera picture, or tunes the timings. */
export function updateSettings(state: State, patch: Partial<DeskSettings>, ctx: Ctx): void {
  snapshot(state, patch.zone !== undefined ? 'Pickup bay change' : 'Settings change')
  state.settings = { ...settingsOf(state), ...patch }
  log(state, ctx, { kind: 'settings', text: patch.zone !== undefined ? 'Pickup bay marked on the camera view' : 'Desk settings changed' })
}
