import { describe, expect, it } from 'vitest'
import { bodyColour, judgeBay, vehiclesOnly, type Detection } from './detector'

const car = (x: number, y: number, score = 0.8): Detection => ({ label: 'car', score, box: { x, y, w: 0.2, h: 0.2 }, colour: 'grey' })

describe('on-device detector', () => {
  it('keeps vehicles only, as fractions of the frame', () => {
    const d = vehiclesOnly(
      [
        { class: 'car', score: 0.9, bbox: [100, 50, 200, 100] },
        { class: 'person', score: 0.9, bbox: [0, 0, 10, 10] },
        { class: 'truck', score: 0.2, bbox: [0, 0, 10, 10] },
      ],
      1000,
      500,
    )
    expect(d).toEqual([{ label: 'car', score: 0.9, box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }])
  })

  it('only counts a vehicle whose centre is inside the bay', () => {
    const bay = { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    expect(judgeBay([car(0.6, 0.6)], bay, null, 0).vehiclePresent).toBe(true)
    expect(judgeBay([car(0.1, 0.1)], bay, null, 0).vehiclePresent).toBe(false)
  })

  it('reports a low-scoring vehicle as unclear rather than a fact', () => {
    expect(judgeBay([car(0.1, 0.1, 0.4)], null, null, 0).vehiclePresent).toBe('unclear')
  })

  it('calls a vehicle moving when its box shifted since the last look', () => {
    const before = { x: 0.3, y: 0.3, w: 0.2, h: 0.2 }
    expect(judgeBay([car(0.3, 0.3)], null, [before], 0).stopped).toBe(true)
    expect(judgeBay([car(0.5, 0.3)], null, [before], 0).stopped).toBe(false)
    // Two parked cars, and the detector's pick switches between them: still nobody moved.
    expect(judgeBay([car(0.5, 0.3, 0.9), car(0.3, 0.3, 0.5)], null, [before, { x: 0.5, y: 0.3, w: 0.2, h: 0.2 }], 0).stopped).toBe(true)
  })

  it('names a coarse body colour', () => {
    const img = (r: number, g: number, b: number) => Uint8Array.from({ length: 10 * 10 * 4 }, (_, i) => [r, g, b, 255][i % 4])
    const all = { x: 0, y: 0, w: 1, h: 1 }
    expect(bodyColour(img(200, 30, 30), 10, 10, all)).toBe('red')
    expect(bodyColour(img(20, 20, 20), 10, 10, all)).toBe('black')
    expect(bodyColour(img(110, 110, 115), 10, 10, all)).toBe('grey')
    expect(bodyColour(img(240, 240, 240), 10, 10, all)).toBe('white')
  })
})
