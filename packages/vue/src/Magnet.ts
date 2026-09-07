import type { MagnetOptions, MagnetTarget } from '@joihouse/magnet-cursor-core'
import { defineComponent, h, shallowRef } from 'vue'
import type { PropType } from 'vue'
import { useMagnet } from './useMagnet'

/**
 * Wrapper component that makes its rendered element magnetic.
 *
 * ```vue
 * <Magnet as="button" :strength="0.4" class="btn">Hover me</Magnet>
 * <Magnet as="a" href="…" magnet-target=".icon" target="_blank">External</Magnet>
 * ```
 *
 * Prefer the `v-magnet` directive when you do not want an extra component in
 * the tree; this exists for templates that would rather pass typed props.
 */
export const Magnet = defineComponent({
  name: 'Magnet',
  inheritAttrs: true,
  props: {
    /** Tag rendered as the hover area. Default `'div'`. */
    as: { type: String, default: 'div' },
    target: [String, Object, Function] as PropType<MagnetTarget>,
    /**
     * The magnet's target, for when `target` is needed by the element itself.
     * When this is set, `target` is forwarded to the DOM instead.
     */
    magnetTarget: [String, Object, Function] as PropType<MagnetTarget>,
    strength: Number,
    padding: Number,
    clampRatio: Number,
    maxMove: [Number, Object] as PropType<MagnetOptions['maxMove']>,
    axis: String as PropType<'both' | 'x' | 'y'>,
    scale: Number,
    activeTransition: String,
    releaseTransition: String,
    disabled: { type: Boolean, default: undefined },
    detectPointer: { type: Boolean, default: undefined },
    respectReducedMotion: { type: Boolean, default: undefined },
  },
  setup(props, { slots }) {
    const el = shallowRef<HTMLElement | null>(null)

    // `target` means two different things on an anchor. Naming the magnet's own
    // target explicitly hands `target` back to the element, so an external link
    // can be magnetic without losing `target="_blank"`.
    const retargeted = () => props.magnetTarget !== undefined

    useMagnet(el, () => {
      const options: MagnetOptions = {}
      for (const [key, value] of Object.entries(props)) {
        if (key === 'as' || key === 'magnetTarget' || value === undefined) continue
        if (key === 'target' && retargeted()) continue
        ;(options as Record<string, unknown>)[key] = value
      }
      if (retargeted()) options.target = props.magnetTarget
      return options
    })

    return () =>
      h(
        props.as,
        {
          ref: el,
          ...(retargeted() && props.target !== undefined ? { target: props.target } : {}),
        },
        slots.default?.(),
      )
  },
})

export default Magnet
