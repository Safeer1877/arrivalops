// Ask an Amazon Bedrock vision model one narrow question about a Ring frame: is a vehicle waiting in the bay?
// Follows Ring's computer-vision guidelines: coarse attributes only (no plates, no people), strict output
// validation, a hard timeout, and an explicit "unclear" instead of a guess.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { z } from 'zod'
import type { VisionResult } from './types'

// With a Bedrock API key the frame goes to Bedrock's OpenAI-compatible endpoint (bedrock-mantle); otherwise to the
// Converse API with the usual AWS credential chain.
const API_KEY = process.env.BEDROCK_API_KEY
const MANTLE_URL = process.env.BEDROCK_MANTLE_URL || `https://bedrock-mantle.${process.env.AWS_REGION || 'us-east-1'}.api.aws/v1`
export const MODEL_ID = process.env.BEDROCK_MODEL_ID || (API_KEY ? 'google.gemma-3-12b-it' : 'us.amazon.nova-lite-v1:0')
const TIMEOUT_MS = Number(process.env.VISION_TIMEOUT_MS || 8000)

const SYSTEM = `You check one still frame from a shop's outdoor camera that watches a curbside pickup bay.
Answer only about vehicles. Never read or report licence plates, and never describe people.
Reply with JSON only, no prose:
{"vehicle_present": "yes"|"no"|"unclear", "stopped": "yes"|"no"|"unclear", "colour": string|null, "type": string|null, "confidence": number}
- The picture is already cropped to the bay. Count a vehicle only when most of it is inside the picture; a bumper,
  shadow or car cut off at the edge is "no".
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

async function askMantle(jpeg: Uint8Array, model: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${MANTLE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}` } },
            { type: 'text', text: 'Is a vehicle waiting in the pickup bay?' },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0,
    }),
    signal,
  })
  const requestId = res.headers.get('x-amzn-requestid')
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200)
    throw new Error(
      res.status === 401 || res.status === 403 ? `Bedrock API key refused (${res.status}): ${body}` : `Bedrock ${res.status}: ${body}`,
    )
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
  console.info(`[vision] Bedrock ${model} answered, request ${requestId}`)
  return data.choices?.[0]?.message?.content ?? ''
}

export async function classifyFrame(jpeg: Uint8Array, model = MODEL_ID): Promise<VisionResult> {
  const started = Date.now()
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
  try {
    if (API_KEY) return parseReply(await askMantle(jpeg, model, abort.signal), model, Date.now() - started)
    client ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' })
    const res = await client.send(
      new ConverseCommand({
        modelId: model,
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
    return parseReply(text, model, Date.now() - started)
  } catch (err) {
    const message = abort.signal.aborted
      ? `timed out after ${TIMEOUT_MS / 1000}s`
      : err instanceof z.ZodError || err instanceof SyntaxError
        ? 'model reply was not valid JSON'
        : err instanceof Error
          ? err.name === 'AccessDeniedException'
            ? `no access to ${model}; enable it under Bedrock > Model access`
            : err.message
          : 'unknown error'
    return {
      vehiclePresent: 'unclear',
      stopped: 'unclear',
      confidence: 0,
      model: model,
      latencyMs: Date.now() - started,
      error: message,
    }
  } finally {
    clearTimeout(timer)
  }
}

// Bedrock is the optional second opinion on top of the on-device detector. It is tried unless
// VISION_PROVIDER=on-device; credentials come from the usual AWS chain (env, ~/.aws, a role). When it fails the desk
// carries on with the detector's answer and rests Bedrock for a while, so a missing or restricted account costs one
// failed call every few minutes, not an error per frame.
const REST_AFTER_REFUSAL_MS = 10 * 60_000
const REST_AFTER_FAILURE_MS = 60_000
let bedrockRestingUntil = 0
let bedrockError: string | undefined

export function bedrockConfigured(): boolean {
  return process.env.VISION_PROVIDER !== 'on-device'
}

export type BedrockState = { state: 'off' } | { state: 'active' } | { state: 'unavailable'; error: string }

export function bedrockState(): BedrockState {
  if (!bedrockConfigured()) return { state: 'off' }
  return bedrockError ? { state: 'unavailable', error: bedrockError } : { state: 'active' }
}

/** The answer for a live frame: Bedrock's when it works, otherwise what the detector in the browser found. */
export async function classifyLive(jpeg: Uint8Array, onDevice?: VisionResult, now = Date.now()): Promise<VisionResult> {
  if (!onDevice) return classifyFrame(jpeg)
  if (!bedrockConfigured() || now < bedrockRestingUntil) return onDevice
  const b = await classifyFrame(jpeg)
  if (b.error) {
    bedrockError = b.error
    const refused = /not allowed|no access|denied|not authori[sz]ed|credential|security token|key refused/i.test(b.error)
    bedrockRestingUntil = now + (refused ? REST_AFTER_REFUSAL_MS : REST_AFTER_FAILURE_MS)
    return onDevice
  }
  bedrockError = undefined
  return combine(onDevice, b)
}

/**
 * The detector decides; Bedrock checks it. Bedrock's answer is recorded in the model line as agreeing or
 * disagreeing, but never changes whether a car is there, whether it stopped, or its colour, so Bedrock alone can
 * never raise or clear an alert. (In testing, Gemma 3 called a grey hatchback a black SUV at 95% confidence.)
 */
export function combine(onDevice: VisionResult, b: VisionResult): VisionResult {
  const verdict = b.vehiclePresent === onDevice.vehiclePresent ? 'agreed' : 'disagreed'
  return { ...onDevice, model: `${onDevice.model}, Bedrock ${b.model.replace(/^[a-z]+\./, '')} ${verdict}` }
}
