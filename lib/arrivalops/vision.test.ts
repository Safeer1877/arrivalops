import { describe, expect, it, vi } from 'vitest'
import { combine, parseReply } from './vision'

describe('parseReply', () => {
  it('accepts a clean reply', () => {
    const r = parseReply('{"vehicle_present":"yes","stopped":"yes","colour":"Silver","type":"SUV","confidence":0.92}', 'm', 300)
    expect(r).toMatchObject({ vehiclePresent: true, stopped: true, colour: 'silver', vehicleType: 'suv', confidence: 0.92 })
  })

  it('tolerates prose around the JSON', () => {
    const r = parseReply('Sure! {"vehicle_present":"no","stopped":"no","colour":null,"type":null,"confidence":0.8} Hope that helps', 'm', 1)
    expect(r.vehiclePresent).toBe(false)
  })

  it('downgrades a low-confidence yes to unclear', () => {
    const r = parseReply('{"vehicle_present":"yes","stopped":"unclear","confidence":0.3}', 'm', 1)
    expect(r.vehiclePresent).toBe('unclear')
    expect(r.stopped).toBe('unclear')
  })

  it('drops anything that is not a plain colour or a known type (no plates sneak through)', () => {
    const r = parseReply('{"vehicle_present":"yes","stopped":"yes","colour":"red ABC-123","type":"plate LEX 42","confidence":0.9}', 'm', 1)
    expect(r.colour).toBeUndefined()
    expect(r.vehicleType).toBeUndefined()
  })

  it('throws on malformed replies so the caller can fall back', () => {
    expect(() => parseReply('no json here', 'm', 1)).toThrow()
    expect(() => parseReply('{"vehicle_present":"maybe","stopped":"yes","confidence":2}', 'm', 1)).toThrow()
  })
})

describe('classifyFrame with a Bedrock API key', () => {
  it('asks the bedrock-mantle endpoint and parses the reply', async () => {
    vi.resetModules()
    vi.stubEnv('BEDROCK_API_KEY', 'test-key')
    vi.stubEnv('BEDROCK_MODEL_ID', '')
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          choices: [
            { message: { content: '{"vehicle_present":"yes","stopped":"yes","colour":"grey","type":"hatchback","confidence":0.9}' } },
          ],
        },
        { headers: { 'x-amzn-requestid': 'req_1' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { classifyFrame, MODEL_ID } = await import('./vision')
    const r = await classifyFrame(new Uint8Array([1, 2, 3]))
    expect(MODEL_ID).toBe('google.gemma-3-12b-it')
    expect(r).toMatchObject({ vehiclePresent: true, colour: 'grey', vehicleType: 'hatchback', model: MODEL_ID })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('reports a refused key as an error, not a guess', async () => {
    vi.resetModules()
    vi.stubEnv('BEDROCK_API_KEY', 'expired')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"expired"}', { status: 401 })),
    )
    const { classifyFrame } = await import('./vision')
    const r = await classifyFrame(new Uint8Array([1]))
    expect(r.vehiclePresent).toBe('unclear')
    expect(r.error).toMatch(/key refused/)
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
})

describe('combine', () => {
  const det = {
    vehiclePresent: true,
    stopped: true,
    colour: 'grey',
    vehicleType: 'car',
    confidence: 0.7,
    model: 'COCO-SSD on-device',
    latencyMs: 5,
  } as const
  const bed = {
    vehiclePresent: true,
    stopped: 'unclear',
    colour: 'black',
    vehicleType: 'suv',
    confidence: 0.95,
    model: 'google.gemma-3-12b-it',
    latencyMs: 3000,
  } as const

  it('keeps the detector answer and notes that Bedrock agreed', () => {
    expect(combine(det, bed)).toMatchObject({
      vehiclePresent: true,
      stopped: true,
      colour: 'grey',
      vehicleType: 'car',
      model: 'COCO-SSD on-device, Bedrock gemma-3-12b-it agreed',
    })
  })

  it('never lets Bedrock alone raise an alert', () => {
    const r = combine({ ...det, vehiclePresent: false }, bed)
    expect(r.vehiclePresent).toBe(false)
    expect(r.model).toContain('disagreed')
  })
})
