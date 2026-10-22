import { randomUUID } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { SHOP_BOARD } from './store'

const COOKIE = 'arrivalops_board'
const VALID = /^[a-f0-9-]{36}$/

export const isLive = () => Boolean(process.env.RING_ACCESS_TOKEN || process.env.RING_REFRESH_TOKEN)

/**
 * Which board a request works on. A shop running live has one board. The replay demo gives each visitor
 * their own, remembered in a cookie, so a judge never lands on a case someone else already resolved.
 */
export function boardFor(request: NextRequest): { boardId: string; isNew: boolean } {
  if (isLive()) return { boardId: SHOP_BOARD, isNew: false }
  const existing = request.cookies.get(COOKIE)?.value
  if (existing && VALID.test(existing)) return { boardId: existing, isNew: false }
  return { boardId: randomUUID(), isNew: true }
}

export function rememberBoard(response: NextResponse, board: { boardId: string; isNew: boolean }) {
  if (board.isNew) {
    response.cookies.set(COOKIE, board.boardId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  }
  return response
}
