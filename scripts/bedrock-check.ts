// Sends the two replay frames to Bedrock through the same code the live desk uses, and prints what came back.
// Reads BEDROCK_API_KEY (or AWS credentials) from .env.local; the key itself is never printed.
// Run: npm run bedrock:check

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

async function main() {
  const { classifyFrame, MODEL_ID } = await import('../lib/arrivalops/vision')
  console.log(`Model: ${MODEL_ID} via ${process.env.BEDROCK_API_KEY ? 'Bedrock API key (bedrock-mantle)' : 'AWS credentials (Converse)'}`)
  for (const name of ['lot-bays-clear.jpg', 'lot-car-in-bay.jpg']) {
    const r = await classifyFrame(new Uint8Array(readFileSync(join(process.cwd(), 'public/replay', name))))
    console.log(name, JSON.stringify(r))
  }
}

main()
