// The hosted demo runs the desk's API inside the visitor's browser: the same handlers as the Next.js routes,
// on one board kept in localStorage. Every judge gets a private board, nothing is stored on a server, and the
// page works on any static-friendly host. Live Ring mode still uses the server routes.

import { getBoard, postAction, postReplay, postTick, type ApiResult } from './api'
import { persistable, setPersistence } from './store'

const BOARD = 'browser'
const KEY = 'arrivalops.board'

let ready = false
function setup() {
  if (ready) return
  ready = true
  setPersistence({
    load() {
      try {
        const saved = localStorage.getItem(KEY)
        return saved ? JSON.parse(saved) : null
      } catch {
        return null
      }
    },
    save(state) {
      try {
        localStorage.setItem(KEY, JSON.stringify(persistable(state)))
      } catch {
        // storage full or blocked: the board still works until the tab closes
      }
    },
  })
}

function route(path: string, method: string, body: unknown): ApiResult {
  if (path === '/api/arrivalops' && method === 'GET') return getBoard(BOARD, { live: false, bedrockModel: '', bedrock: { state: 'off' } })
  if (path === '/api/arrivalops' && method === 'POST') return postAction(BOARD, body)
  if (path === '/api/arrivalops/tick') return postTick(BOARD, false)
  if (path === '/api/arrivalops/tick?speak=1') return postTick(BOARD, true)
  if (path === '/api/arrivalops/replay') return postReplay(BOARD, (body as { step?: unknown } | null)?.step)
  return { status: 404, body: { error: 'Not available in the browser demo' } }
}

/** A drop-in for fetch() on the desk's own endpoints. */
export async function browserFetch(path: string, init: RequestInit = {}): Promise<Response> {
  setup()
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : null
  const { status, body: json } = route(path, init.method ?? 'GET', body)
  return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } })
}
