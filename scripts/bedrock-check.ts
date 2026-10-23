// Sends the two replay frames to Bedrock through the same code the live desk uses, and prints what came back.
// Reads BEDROCK_API_KEY (or AWS credentials) from .env.local; the key itself is never printed.
// Run: npm run bedrock:check [model ...]   (with an API key and no model named, it tries a few that read images)

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnvConfig } from '@next/env'
import jpeg from 'jpeg-js'
import { DEMO_SETTINGS } from '../lib/arrivalops/seed'

loadEnvConfig(process.cwd())

const IMAGE_MODELS = [
  'google.gemma-3-12b-it',
  'mistral.ministral-3-8b-instruct',
  'mistral.ministral-3-14b-instruct',
  'qwen.qwen3-vl-235b-a22b',
]

// The live desk sends only the marked bay, so the check does too (the demo's default bay).
function bayCrop(file: Buffer): Uint8Array {
  const img = jpeg.decode(file, { useTArray: true })
  const z = DEMO_SETTINGS.zone!
  const x0 = Math.round(z.x * img.width)
  const y0 = Math.round(z.y * img.height)
  const w = Math.round(z.w * img.width)
  const h = Math.round(z.h * img.height)
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) out.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4)
  return new Uint8Array(jpeg.encode({ data: out, width: w, height: h }, 80).data)
}

async function main() {
  const { classifyFrame, MODEL_ID } = await import('../lib/arrivalops/vision')
  const key = process.env.BEDROCK_API_KEY
  console.log(`Route: ${key ? 'Bedrock API key (bedrock-mantle)' : 'AWS credentials (Converse)'}`)
  const named = process.argv.slice(2)
  const models = named.length ? named : key && !process.env.BEDROCK_MODEL_ID ? IMAGE_MODELS : [MODEL_ID]
  for (const model of models) {
    for (const name of ['lot-bays-clear.jpg', 'lot-car-in-bay.jpg']) {
      const r = await classifyFrame(bayCrop(readFileSync(join(process.cwd(), 'public/replay', name))), model)
      console.log(`${model} ${name} ${JSON.stringify(r)}`)
      if (r.error) break
    }
  }
}

main()
