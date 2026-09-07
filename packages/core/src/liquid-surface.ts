/**
 * The painted half of the gravitational liquid: an SVG that replaces an
 * element's background and can have a hole eroded into it.
 *
 * Two stacked rects fill the element. The lower one is the liquid colour; the
 * upper one is the element's own surface colour, masked by a rect-minus-circle
 * so the liquid shows through wherever the circle sits. Both rects run through
 * the same goo filter — a blur followed by an alpha threshold — which is what
 * turns a plain circular hole into a bite with shoulders, and lets the bite
 * break through an edge with a neck of surface tension rather than being
 * clipped flat.
 *
 * The filter has to be on *both* rects, not just the masked one: the threshold
 * moves every edge it touches by a fraction of a pixel, so an unfiltered liquid
 * layer would peek out from behind the filtered surface at the corners.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Blur radii beyond which a Gaussian contributes nothing worth rendering. */
const BLUR_SPILL = 3
/** Slack on the filter region so rounding never crops the outermost pixel. */
const REGION_PAD = 2

let uid = 0

export interface LiquidSurfaceInit {
  /** Paint of the surface being eroded. Any SVG paint value. */
  surface: string
  /** Paint revealed through the erosion. */
  liquidColor: string
  /** Diameter of the eroding blob, px. */
  size: number
  /** Corner radius of both rects, px. */
  rounded: number
  /** Goo blur radius, px. */
  tension: number
}

export interface LiquidSurface {
  /** The root node, already inserted into the element. */
  readonly svg: SVGSVGElement
  /** Write one frame's pose. `bite` is 0..1, `stretch` is the elongation. */
  setPose: (x: number, y: number, angle: number, stretch: number, bite: number) => void
  setSurface: (paint: string) => void
  setLiquidColor: (paint: string) => void
  setSize: (size: number) => void
  setRounded: (radius: number) => void
  setTension: (tension: number) => void
  /** Re-measure the surface and re-fit the filter region to it. */
  fitRegion: () => void
  destroy: () => void
}

/**
 * Build the surface and insert it as the element's first child.
 *
 * The caller owns making room for it (position, isolation, a transparent
 * background); this module only owns what is painted.
 */
export function createLiquidSurface(element: HTMLElement, init: LiquidSurfaceInit): LiquidSurface {
  uid += 1
  const gooId = `mc-liquid-tension-${uid}`
  const maskId = `mc-liquid-bite-${uid}`

  let size = init.size
  let tension = init.tension

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:-1'

  svg.innerHTML = `<defs>
<filter id="${gooId}" filterUnits="userSpaceOnUse">
<feGaussianBlur in="SourceGraphic" stdDeviation="${tension}" result="blur"/>
<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"/>
</filter>
<mask id="${maskId}">
<rect x="0" y="0" width="100%" height="100%" fill="#fff"/>
<g class="mc-liquid-follow"><g class="mc-liquid-stretch"><g class="mc-liquid-bite">
<circle cx="50%" cy="50%" r="${size / 2}" fill="#000"/>
</g></g></g>
</mask>
</defs>
<g filter="url(#${gooId})"><rect class="mc-liquid-reveal" x="0" y="0" width="100%" height="100%" rx="${init.rounded}" ry="${init.rounded}" fill="${init.liquidColor}"/></g>
<g filter="url(#${gooId})"><rect class="mc-liquid-surface" x="0" y="0" width="100%" height="100%" rx="${init.rounded}" ry="${init.rounded}" fill="${init.surface}" mask="url(#${maskId})"/></g>`

  const pick = <T extends SVGElement>(selector: string) => svg.querySelector(selector) as T
  const followEl = pick<SVGGElement>('.mc-liquid-follow')
  const stretchEl = pick<SVGGElement>('.mc-liquid-stretch')
  const biteEl = pick<SVGGElement>('.mc-liquid-bite')
  const revealEl = pick<SVGRectElement>('.mc-liquid-reveal')
  const surfaceEl = pick<SVGRectElement>('.mc-liquid-surface')
  const filterEl = pick<SVGFilterElement>('filter')
  const blurEl = pick<SVGFEGaussianBlurElement>('feGaussianBlur')
  const circleEl = pick<SVGCircleElement>('circle')

  for (const group of [followEl, stretchEl, biteEl]) {
    group.style.transformBox = 'fill-box'
    group.style.transformOrigin = 'center'
    group.style.willChange = 'transform'
  }

  // The frame loop does not run until the pointer arrives, so the resting pose
  // has to be written now. Without it the mask's circle sits at full radius in
  // the middle of the surface and the liquid shows through a hole that was
  // never bitten.
  followEl.style.transform = 'translate(0px, 0px)'
  stretchEl.style.transform = 'rotate(0deg) scale(1, 1)'
  biteEl.style.transform = 'scale(0)'

  let regionWidth = 0
  let regionHeight = 0

  /**
   * Size the filter region.
   *
   * The old percentage region (`-50%`/`200%`) scaled the slack with the
   * element, which is wrong in both directions: on a wide, short button the
   * vertical slack was smaller than the blur actually spills, clipping the
   * shoulders, while on a large panel it blurred four times the area for no
   * visual gain. The spill is an absolute distance — three blur radii, plus the
   * blob's own radius so a bite parked on an edge is still fully drawn.
   */
  const writeRegion = () => {
    if (regionWidth <= 0 || regionHeight <= 0) return
    const margin = BLUR_SPILL * tension + size / 2 + REGION_PAD
    filterEl.setAttribute('x', String(-margin))
    filterEl.setAttribute('y', String(-margin))
    filterEl.setAttribute('width', String(regionWidth + margin * 2))
    filterEl.setAttribute('height', String(regionHeight + margin * 2))
  }

  /**
   * Re-measure the region from the SVG itself.
   *
   * It has to be the SVG's own box and not the element's: the SVG is
   * `position: absolute; inset: 0`, so its viewport is the element's *padding*
   * box, which is neither the border box nor the content box a ResizeObserver
   * entry hands over. Measuring the wrong one silently shrinks the filter
   * region and the bite is cut off flat wherever it runs past it.
   */
  const fitRegion = () => {
    const box = svg.getBoundingClientRect()
    if (box.width === regionWidth && box.height === regionHeight) return
    regionWidth = box.width
    regionHeight = box.height
    writeRegion()
  }

  element.insertBefore(svg, element.firstChild)
  fitRegion()

  return {
    svg,

    setPose(x, y, angle, stretch, bite) {
      followEl.style.transform = `translate(${x}px, ${y}px)`
      stretchEl.style.transform = `rotate(${angle}deg) scale(${stretch}, ${1 / stretch})`
      biteEl.style.transform = `scale(${bite})`
    },

    setSurface(paint) {
      surfaceEl.setAttribute('fill', paint)
    },

    setLiquidColor(paint) {
      revealEl.setAttribute('fill', paint)
    },

    setSize(next) {
      size = next
      circleEl.setAttribute('r', String(next / 2))
      writeRegion()
    },

    setRounded(radius) {
      for (const target of [revealEl, surfaceEl]) {
        target.setAttribute('rx', String(radius))
        target.setAttribute('ry', String(radius))
      }
    },

    setTension(next) {
      tension = next
      blurEl.setAttribute('stdDeviation', String(next))
      writeRegion()
    },

    fitRegion,

    destroy() {
      svg.remove()
    },
  }
}
