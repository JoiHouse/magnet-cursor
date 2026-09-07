/**
 * A damped harmonic oscillator, integrated per frame.
 *
 * Every trailing effect in this package used to be a first order low pass —
 * `value += (target - value) * (1 - exp(-dt / tau))`. That can only ever crawl
 * towards its target: it has no momentum, so it can never be carried past the
 * thing it is chasing and pulled back. A liquid that is *attracted* to the
 * pointer needs exactly that, so the follow is a real spring instead.
 */

/** Resolved spring coefficients, in the units the integrator wants. */
export interface SpringConfig {
  /** Undamped natural frequency, rad/s. Sets how quickly the spring responds. */
  omega: number
  /** Damping ratio. `1` is critical (no overshoot), below `1` overshoots. */
  zeta: number
}

/** A 2D spring's live state. Mutated in place, so a frame allocates nothing. */
export interface Spring2 {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Longest step the integrator ever takes.
 *
 * Explicit integrators go unstable once `omega * h` approaches 2, and the
 * fastest spring this module can be configured for sits near `omega = 80`. A
 * 240 Hz substep keeps `omega * h` under 0.34 even on a 20 fps frame, so a
 * janky tab makes the liquid late rather than making it explode.
 */
const MAX_SUBSTEP = 1 / 240

/** Response times, in seconds, that the `damping` range maps onto. */
const RESPONSE_MIN = 0.06
const RESPONSE_MAX = 1.1

/**
 * A critically damped spring is within 5% of its target after `4.75 / omega`
 * seconds, which is the number that makes `RESPONSE_*` read as wall clock.
 */
const SETTLING_CONSTANT = 4.75

/** Damping ratios the `elasticity` range maps onto. */
const ZETA_STIFF = 1
const ZETA_LOOSE = 0.4

/** Below these the spring counts as arrived, in px and px/s. */
const POSITION_EPSILON = 0.01
const VELOCITY_EPSILON = 0.1

/**
 * Turn the two user facing knobs into coefficients.
 *
 * `damping` (0..100) is laziness — how long the liquid takes to arrive.
 * `elasticity` (0..1) is how much of that arrival overshoots.
 */
export const resolveSpring = (damping: number, elasticity: number): SpringConfig => {
  const response = RESPONSE_MIN + (damping / 100) * (RESPONSE_MAX - RESPONSE_MIN)
  return {
    omega: SETTLING_CONSTANT / response,
    zeta: ZETA_STIFF + elasticity * (ZETA_LOOSE - ZETA_STIFF),
  }
}

export const createSpring2 = (x = 0, y = 0): Spring2 => ({ x, y, vx: 0, vy: 0 })

/** Drop the spring onto a point with no residual momentum. */
export const resetSpring2 = (spring: Spring2, x: number, y: number): void => {
  spring.x = x
  spring.y = y
  spring.vx = 0
  spring.vy = 0
}

/**
 * Advance the spring by `dt` seconds.
 *
 * Semi-implicit Euler: velocity is integrated first and the *new* velocity
 * moves the position. Unlike explicit Euler it does not pump energy into the
 * system, so a lightly damped spring rings down instead of up.
 */
export const stepSpring2 = (
  spring: Spring2,
  targetX: number,
  targetY: number,
  config: SpringConfig,
  dt: number,
): void => {
  const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP))
  const h = dt / steps
  const stiffness = config.omega * config.omega
  const drag = 2 * config.zeta * config.omega

  for (let i = 0; i < steps; i += 1) {
    spring.vx += (stiffness * (targetX - spring.x) - drag * spring.vx) * h
    spring.vy += (stiffness * (targetY - spring.y) - drag * spring.vy) * h
    spring.x += spring.vx * h
    spring.y += spring.vy * h
  }
}

/**
 * Whether the spring has both arrived and stopped.
 *
 * Position alone is not enough: an overshooting spring passes exactly through
 * its target at full speed, and calling that "settled" would freeze the frame
 * loop mid-swing.
 */
export const spring2Settled = (spring: Spring2, targetX: number, targetY: number): boolean =>
  Math.abs(targetX - spring.x) < POSITION_EPSILON &&
  Math.abs(targetY - spring.y) < POSITION_EPSILON &&
  Math.abs(spring.vx) < VELOCITY_EPSILON &&
  Math.abs(spring.vy) < VELOCITY_EPSILON

/** First order approach, for the scalars that must never overshoot. */
export const approach = (current: number, target: number, dt: number, tau: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / tau))

/**
 * Fold a degree delta into (-90, 90].
 *
 * The stretch is written as `scale(s, 1/s)`, which is symmetric under a half
 * turn — pointing the long axis at 10° and at 190° paint the same ellipse. So
 * the angle only has to be smoothed modulo 180°, and reversing direction costs
 * no rotation at all instead of spinning the long way round.
 */
export const wrapHalfTurn = (degrees: number): number => ((((degrees + 90) % 180) + 180) % 180) - 90
