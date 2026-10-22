// Board state, kept in memory. The shop's own board (live mode) can be persisted to disk so a restart doesn't
// lose it; the hosted replay demo gives every visitor a separate throwaway board so nobody sees anyone
// else's clicks. Every change goes through `dispatch`, which validates input and returns the fresh view.

import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { computeMetrics } from './metrics'
import { ActionError, casesToAnnounce, confirmMatch, dismiss, handOver, observe, posCheckIn, undo, type Ctx } from './reconcile'
import { seedState } from './seed'
import type { Observation, State, VisionResult } from './types'

const DATA_FILE = process.env.ARRIVALOPS_DATA_DIR ? join(process.env.ARRIVALOPS_DATA_DIR, 'state.json') : null

export const SHOP_BOARD = 'shop'
const MAX_VISITOR_BOARDS = 500

const g = globalThis as unknown as { __arrivalops?: Map<string, State> }

function load(boardId: string): State {
  if (boardId === SHOP_BOARD && DATA_FILE && existsSync(DATA_FILE)) {
    try {
      return JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    } catch {
      // fall through to a fresh board
    }
  }
  return seedState()
}

export function getState(boardId = SHOP_BOARD): State {
  const boards = (g.__arrivalops ??= new Map())
  let state = boards.get(boardId)
  if (state) {
    boards.delete(boardId) // re-insert so the Map's order doubles as least-recently-used
  } else {
    state = load(boardId)
    if (boards.size >= MAX_VISITOR_BOARDS) boards.delete(boards.keys().next().value!)
  }
  boards.set(boardId, state)
  return state
}

function save(state: State, boardId: string) {
  if (!DATA_FILE || boardId !== SHOP_BOARD) return
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

export function dispatch(input: unknown, ctx = ctxNow(), boardId = SHOP_BOARD) {
  const parsed = Action.safeParse(input)
  if (!parsed.success) throw new ActionError(400, parsed.error.issues.map((i) => i.message).join('; '))
  const a = parsed.data
  let state = getState(boardId)
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
      state = seedState(ctx.now)
      g.__arrivalops!.set(boardId, state)
      break
  }
  save(state, boardId)
  return view(state, ctx.now)
}

export function recordObservation(
  input: { deviceId: string; deviceName?: string; source: Observation['source']; frame?: string },
  vision: VisionResult,
  ctx = ctxNow(),
  boardId = SHOP_BOARD,
) {
  const state = getState(boardId)
  const obs: Observation = { id: ctx.id('obs'), at: ctx.now.toISOString(), ...input, vision }
  const c = observe(state, obs, ctx)
  save(state, boardId)
  return { caseId: c?.id ?? null, view: view(state, ctx.now) }
}

/** Mark overdue cases as announced and return them; the caller plays them on the chime. */
export function takeAnnouncements(ctx = ctxNow(), boardId = SHOP_BOARD) {
  const state = getState(boardId)
  const due = casesToAnnounce(state, ctx.now)
  for (const c of due) c.chimeAnnouncedAt = ctx.now.toISOString()
  if (due.length) save(state, boardId)
  return due
}
