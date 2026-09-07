/** One participant's slot in the shared frame: read layout, then write it back. */
export interface FrameTick {
  measure: () => void
  commit: () => void
}

/*
 * Every pointer effect in this package shares a single animation frame. Within
 * it all layout reads run before any write, so a transform written by one
 * effect can never invalidate the rect another is about to read — nested or
 * overlapping effects cost one layout pass instead of one per element.
 */
const pending = new Set<FrameTick>()
let frameId = 0
let scheduled = false

const runBatch = () => {
  scheduled = false
  frameId = 0

  const due = [...pending]
  pending.clear()

  for (const tick of due) tick.measure()
  for (const tick of due) tick.commit()
}

/** Queue a tick for the next shared frame. Queuing the same tick twice is a no-op. */
export const scheduleTick = (tick: FrameTick): void => {
  pending.add(tick)
  if (scheduled) return
  scheduled = true
  const id = requestAnimationFrame(runBatch)
  // If the callback already ran, the batch is done and the id is stale.
  if (scheduled) frameId = id
}

/** Drop a tick, cancelling the frame when nothing is left to do. */
export const cancelTick = (tick: FrameTick): void => {
  pending.delete(tick)
  if (pending.size > 0 || !scheduled) return
  scheduled = false
  if (frameId !== 0) cancelAnimationFrame(frameId)
  frameId = 0
}
