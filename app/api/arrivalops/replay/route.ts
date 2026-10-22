import { NextRequest, NextResponse } from 'next/server'
import { postReplay } from '@/lib/arrivalops/api'
import { boardFor, rememberBoard } from '@/lib/arrivalops/board'
import '@/lib/arrivalops/diskPersistence'

export const dynamic = 'force-dynamic'

// Plays one step of the recorded Playground session; see postReplay.
export async function POST(request: NextRequest) {
  const { step } = await request.json().catch(() => ({ step: -1 }))
  const board = boardFor(request)
  const { status, body } = postReplay(board.boardId, step)
  return rememberBoard(NextResponse.json(body, { status }), board)
}
