import { describe, expect, it } from 'vitest'
import { parseReply } from './vision'

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
