import { NextRequest, NextResponse } from 'next/server'
import { boardFor, isLive, rememberBoard } from '@/lib/arrivalops/board'
import { ActionError } from '@/lib/arrivalops/reconcile'
import { DETECTOR_MODEL } from '@/lib/arrivalops/detector'
import { ctxNow, dispatch, getState, view } from '@/lib/arrivalops/store'
import { bedrockState, MODEL_ID } from '@/lib/arrivalops/vision'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const board = boardFor(request)
  const res = NextResponse.json({
    ...view(getState(board.boardId)),
    mode: {
      live: isLive(),
      detectorModel: DETECTOR_MODEL,
      bedrockModel: MODEL_ID,
      bedrock: bedrockState(),
    },
  })
  return rememberBoard(res, board)
}

export async function POST(request: NextRequest) {
  const board = boardFor(request)
  try {
    return rememberBoard(NextResponse.json(dispatch(await request.json(), ctxNow(), board.boardId)), board)
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('ArrivalOps action failed:', err)
    return NextResponse.json({ error: 'Something went wrong; nothing was changed.' }, { status: 500 })
  }
}
