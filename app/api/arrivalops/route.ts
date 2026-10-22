import { NextRequest, NextResponse } from 'next/server'
import { getBoard, postAction } from '@/lib/arrivalops/api'
import { boardFor, isLive, rememberBoard } from '@/lib/arrivalops/board'
import '@/lib/arrivalops/diskPersistence'
import { bedrockState, MODEL_ID } from '@/lib/arrivalops/vision'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const board = boardFor(request)
  const { status, body } = getBoard(board.boardId, { live: isLive(), bedrockModel: MODEL_ID, bedrock: bedrockState() })
  return rememberBoard(NextResponse.json(body, { status }), board)
}

export async function POST(request: NextRequest) {
  const board = boardFor(request)
  const { status, body } = postAction(board.boardId, await request.json().catch(() => null))
  return rememberBoard(NextResponse.json(body, { status }), board)
}
