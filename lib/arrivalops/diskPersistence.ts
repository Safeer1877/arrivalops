// Server only: keeps the shop's own board in ARRIVALOPS_DATA_DIR/state.json, so a restart of the live desk
// doesn't lose the day. Visitor boards on the replay demo are never written to disk.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { persistable, SHOP_BOARD, setPersistence } from './store'

const DATA_FILE = process.env.ARRIVALOPS_DATA_DIR ? join(process.env.ARRIVALOPS_DATA_DIR, 'state.json') : null

if (DATA_FILE) {
  setPersistence({
    load(boardId) {
      if (boardId !== SHOP_BOARD || !existsSync(DATA_FILE)) return null
      try {
        return JSON.parse(readFileSync(DATA_FILE, 'utf8'))
      } catch {
        return null
      }
    },
    save(state, boardId) {
      if (boardId !== SHOP_BOARD) return
      mkdirSync(join(DATA_FILE, '..'), { recursive: true })
      writeFileSync(DATA_FILE, JSON.stringify(persistable(state)))
    },
  })
}
