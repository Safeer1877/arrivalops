import { describe, expect, it } from 'vitest'
import { friendlyCameraError } from './cameraErrors'

describe('friendlyCameraError', () => {
  it('explains an expired Playground token instead of showing a bare 401', () => {
    expect(friendlyCameraError('Ring API returned 401')).toMatch(/expired.*30 minutes/)
    expect(friendlyCameraError('Unauthorized')).toMatch(/expired/)
  })

  it('points at the Playground simulation when no camera is found', () => {
    expect(friendlyCameraError('No Ring devices found')).toMatch(/Vehicle simulation/)
  })

  it('passes through anything it does not recognise', () => {
    expect(friendlyCameraError('ICE failed')).toBe('ICE failed')
  })
})
