import { describe, expect, it } from 'vitest'
import {
  approach,
  createSpring2,
  resetSpring2,
  resolveSpring,
  spring2Settled,
  stepSpring2,
  wrapHalfTurn,
} from '../src/spring'

const FRAME = 1 / 60

/** Run the spring towards a target and report the furthest point it reached. */
const settleWith = (elasticity: number, target = 100, frames = 600) => {
  const spring = createSpring2()
  const config = resolveSpring(55, elasticity)
  let peak = 0
  for (let i = 0; i < frames; i += 1) {
    stepSpring2(spring, target, 0, config, FRAME)
    peak = Math.max(peak, spring.x)
    if (spring2Settled(spring, target, 0)) break
  }
  return { spring, peak }
}

describe('resolveSpring', () => {
  it('maps damping onto response time, not onto stiffness directly', () => {
    // A lazier spring is a slower spring: omega falls as damping rises.
    expect(resolveSpring(0, 0).omega).toBeGreaterThan(resolveSpring(100, 0).omega)
  })

  it('maps elasticity onto the damping ratio', () => {
    expect(resolveSpring(55, 0).zeta).toBe(1)
    expect(resolveSpring(55, 1).zeta).toBeCloseTo(0.4, 6)
    expect(resolveSpring(55, 0.25).zeta).toBeCloseTo(0.85, 6)
  })
})

describe('stepSpring2', () => {
  it('never overshoots when elasticity is 0', () => {
    const { peak } = settleWith(0)
    expect(peak).toBeLessThanOrEqual(100 + 1e-6)
  })

  it('is thrown past the target and drawn back when elasticity is high', () => {
    const { peak, spring } = settleWith(1)
    expect(peak).toBeGreaterThan(100)
    // …and still comes to rest on the target rather than ringing forever.
    expect(spring.x).toBeCloseTo(100, 1)
  })

  it('overshoots further the more elastic it is', () => {
    expect(settleWith(1).peak).toBeGreaterThan(settleWith(0.25).peak)
  })

  it('stays stable at the fastest setting on a long frame', () => {
    // A 20 fps frame against the stiffest spring: explicit integration would
    // blow up here, which is what the substepping exists to prevent.
    const spring = createSpring2()
    const config = resolveSpring(0, 1)
    for (let i = 0; i < 200; i += 1) stepSpring2(spring, 100, 0, config, 0.05)
    expect(spring.x).toBeCloseTo(100, 3)
    expect(Number.isFinite(spring.vx)).toBe(true)
  })

  it('integrates both axes with the same coefficients', () => {
    const spring = createSpring2()
    const config = resolveSpring(55, 0.25)
    for (let i = 0; i < 10; i += 1) stepSpring2(spring, 70, 70, config, FRAME)
    expect(spring.x).toBeCloseTo(spring.y, 10)
  })
})

describe('spring2Settled', () => {
  it('refuses to settle a spring passing through its target at speed', () => {
    const spring = createSpring2(0, 0)
    spring.vx = 400
    expect(spring2Settled(spring, 0, 0)).toBe(false)
  })

  it('settles once the spring has both arrived and stopped', () => {
    const spring = createSpring2(0, 0)
    expect(spring2Settled(spring, 0, 0)).toBe(true)
  })
})

describe('resetSpring2', () => {
  it('drops the spring with no residual momentum', () => {
    const spring = createSpring2()
    spring.vx = 900
    spring.vy = -900
    resetSpring2(spring, 12, 34)
    expect(spring).toEqual({ x: 12, y: 34, vx: 0, vy: 0 })
  })
})

describe('approach', () => {
  it('is frame rate independent', () => {
    const one = approach(0, 1, 0.1, 0.09)
    let many = 0
    for (let i = 0; i < 10; i += 1) many = approach(many, 1, 0.01, 0.09)
    expect(many).toBeCloseTo(one, 6)
  })
})

describe('wrapHalfTurn', () => {
  it('folds a half turn away, because scale(s, 1/s) is symmetric under one', () => {
    expect(wrapHalfTurn(180)).toBe(0)
    expect(wrapHalfTurn(-180)).toBe(0)
    expect(wrapHalfTurn(190)).toBeCloseTo(10, 10)
  })

  it('takes the short way round a direction reversal', () => {
    // 179° to -179° is a 358° delta the long way, 2° the short way.
    expect(Math.abs(wrapHalfTurn(-179 - 179))).toBeLessThanOrEqual(2 + 1e-9)
  })

  it('stays inside (-90, 90]', () => {
    for (let d = -720; d <= 720; d += 7) {
      const wrapped = wrapHalfTurn(d)
      expect(wrapped).toBeGreaterThan(-90 - 1e-9)
      expect(wrapped).toBeLessThanOrEqual(90 + 1e-9)
    }
  })
})
