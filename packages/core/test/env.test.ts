import { describe, expect, it } from 'vitest'
import { clamp, isBrowser, lerp } from '../src/env'

describe('env helpers', () => {
  it('lerps between two values', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 1)).toBe(10)
    expect(lerp(0, 10, 0.2)).toBeCloseTo(2)
  })

  it('clamps into range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(50, 0, 10)).toBe(10)
  })

  it('detects the jsdom browser environment', () => {
    expect(isBrowser()).toBe(true)
  })
})
