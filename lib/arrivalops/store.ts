// One shop's state, kept in memory and (optionally) persisted to disk so a restart doesn't lose the board.
// Every change goes through `dispatch`, which validates input and returns the fresh view.

import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { computeMetrics } from './metrics'
import {
  ActionError,
  casesToAnnounce,
  confirmMatch,
  dismiss,
  handOver,
  observe,
  posCheckIn,
  undo,
  type Ctx,
} from './reconcile'
import { seedState } from './seed'
import type { Observation, State, VisionResult } from './types'

const DATA_FILE = process.env.ARRIVALOPS_DATA_DIR ? join(process.env.ARRIVALOPS_DATA_DIR, 'state.json') : null

const g = globalThis as unknown as { __arrivalops?: State }

function load(): State {
  if (DATA_FILE && existsSync(DATA_FILE)) {
    try {
      return JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    } catch {
      // fall through to a fresh board
    }
  }
  return seedState()
}

export function getState(): State {
  g.__arrivalops ??= load()
  return g.__arrivalops
}

function save(state: State) {
  if (!DATA_FILE) return
  mkdirSync(join(DATA_FILE, '..'), { recursive: true })
  const { undo: _u, ...rest } = state
  writeFileSync(DATA_FILE, JSON.stringify({ ...rest, observations: rest.observations.slice(0, 20) }))
}

export function ctxNow(): Ctx {
  return { now: new Date(), id: (p) => `${p}_${randomUUID().slice(0, 8)}` }
}

export function view(state = getState(), now = new Date()) {
  return {
    orders: state.orders,
    cases: state.cases,
    observations: state.observations.slice(0, 12),
    activity: state.activity.slice(0, 40),
    metrics: computeMetrics(state, now),
    canUndo: state.undo?.label ?? null,
    now: now.toISOString(),
  }
}

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm'), caseId: z.string(), orderId: z.string() }),
  z.object({ action: z.literal('dismiss'), caseId: z.string(), reason: z.enum(['not_a_customer', 'already_served', 'false_detection']) }),
  z.object({ action: z.literal('hand_over'), orderId: z.string() }),
  z.object({ action: z.literal('pos_check_in'), orderId: z.string() }),
  z.object({ action: z.literal('undo') }),
  z.object({ action: z.literal('reset') }),
])
export type ActionInput = z.infer<typeof Action>

export function dispatch(input: unknown, ctx = ctxNow()) {
  const parsed = Action.safeParse(input)
  if (!parsed.success) throw new ActionError(400, parsed.error.issues.map((i) => i.message).join('; '))
  const a = parsed.data
  let state = getState()
  switch (a.action) {
    case 'confirm':
      confirmMatch(state, a.caseId, a.orderId, ctx)
      break
    case 'dismiss':
      dismiss(state, a.caseId, a.reason, ctx)
      break
    case 'hand_over':
      handOver(state, a.orderId, ctx)
      break
    case 'pos_check_in':
      posCheckIn(state, a.orderId, ctx)
      break
    case 'undo':
      undo(state, ctx)
      break
    case 'reset':
      state = g.__arrivalops = seedState(ctx.now)
      break
  }
  save(state)
  return view(state, ctx.now)
}

export function recordObservation(
  input: { deviceId: string; deviceName?: string; source: Observation['source']; frame?: string },
  vision: VisionResult,
  ctx = ctxNow()
) {
  const state = getState()
  const obs: Observation = { id: ctx.id('obs'), at: ctx.now.toISOString(), ...input, vision }
  const c = observe(state, obs, ctx)
  save(state)
  return { caseId: c?.id ?? null, view: view(state, ctx.now) }
}

/** Mark overdue cases as announced and return them; the caller plays them on the chime. */
export function takeAnnouncements(ctx = ctxNow()) {
  const state = getState()
  const due = casesToAnnounce(state, ctx.now)
  for (const c of due) c.chimeAnnouncedAt = ctx.now.toISOString()
  if (due.length) save(state)
  return due
}
