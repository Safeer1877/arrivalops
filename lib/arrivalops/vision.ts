// Ask an Amazon Bedrock vision model one narrow question about a Ring frame: is a vehicle waiting in the bay?
// Follows Ring's computer-vision guidelines: coarse attributes only (no plates, no people), strict output
// validation, a hard timeout, and an explicit "unclear" instead of a guess.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { z } from 'zod'
import type { VisionResult } from './types'

export const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.amazon.nova-lite-v1:0'
const TIMEOUT_MS = Number(process.env.VISION_TIMEOUT_MS || 8000)

const SYSTEM = `You check one still frame from a shop's outdoor camera that watches a curbside pickup bay.
Answer only about vehicles. Never read or report licence plates, and never describe people.
Reply with JSON only, no prose:
{"vehicle_present": "yes"|"no"|"unclear", "stopped": "yes"|"no"|"unclear", "colour": string|null, "type": string|null, "confidence": number}
- "stopped" is "yes" when the vehicle appears parked or waiting, "no" when it is clearly driving past.
- "colour" is one plain word (e.g. "silver"); "type" is one of sedan, hatchback, suv, pickup, van, motorcycle, other.
- Use "unclear" when night, glare, blur or occlusion make you unsure. Do not guess.`

const Reply = z.object({
  vehicle_present: z.enum(['yes', 'no', 'unclear']),
  stopped: z.enum(['yes', 'no', 'unclear']),
  colour: z.string().max(20).nullable().optional(),
  type: z.string().max(20).nullable().optional(),
  confidence: z.number().min(0).max(1),
})

const tri = (v: 'yes' | 'no' | 'unclear'): boolean | 'unclear' => (v === 'unclear' ? 'unclear' : v === 'yes')
const ALLOWED_TYPES = new Set(['sedan', 'hatchback', 'suv', 'pickup', 'van', 'motorcycle', 'other'])

/** Parse and sanitise the model's reply. Exported for tests. */
export function parseReply(text: string, model: string, latencyMs: number): VisionResult {
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  const r = Reply.parse(JSON.parse(json))
  const type = r.type?.toLowerCase().trim()
  // Low-confidence "yes" is treated as unclear so staff see it as a soft signal, not a fact.
  const present = r.confidence < 0.5 && r.vehicle_present === 'yes' ? 'unclear' : tri(r.vehicle_present)
  return {
    vehiclePresent: present,
    stopped: tri(r.stopped),
    colour: r.colour?.toLowerCase().match(/^[a-z]+$/)?.[0],
    vehicleType: type && ALLOWED_TYPES.has(type) ? type : undefined,
    confidence: r.confidence,
    model,
    latencyMs,
  }
}

let client: BedrockRuntimeClient | null = null

export async function classifyFrame(jpeg: Uint8Array): Promise<VisionResult> {
  const started = Date.now()
  client ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' })
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
  try {
    const res = await client.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM }],
        messages: [
          {
            role: 'user',
            content: [{ image: { format: 'jpeg', source: { bytes: jpeg } } }, { text: 'Is a vehicle waiting in the pickup bay?' }],
          },
        ],
        inferenceConfig: { maxTokens: 120, temperature: 0 },
      }),
      { abortSignal: abort.signal },
    )
    const text = res.output?.message?.content?.find((c) => 'text' in c && c.text)?.text ?? ''
    return parseReply(text, MODEL_ID, Date.now() - started)
  } catch (err) {
    const message = abort.signal.aborted
      ? `timed out after ${TIMEOUT_MS / 1000}s`
      : err instanceof z.ZodError || err instanceof SyntaxError
        ? 'model reply was not valid JSON'
        : err instanceof Error
          ? err.name === 'AccessDeniedException'
            ? `no access to ${MODEL_ID}; enable it under Bedrock > Model access`
            : err.message
          : 'unknown error'
    return {
      vehiclePresent: 'unclear',
      stopped: 'unclear',
      confidence: 0,
      model: MODEL_ID,
      latencyMs: Date.now() - started,
      error: message,
    }
  } finally {
    clearTimeout(timer)
  }
}
