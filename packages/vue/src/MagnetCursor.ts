import type { MagnetCursorOptions } from '@joihouse/magnet-cursor-core'
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import { useMagnetCursor } from './useMagnetCursor'

/**
 * Renderless component that mounts the custom cursor while it is alive.
 *
 * Drop it once, near the root of the app:
 *
 * ```vue
 * <MagnetCursor color="#000" hide-native-cursor />
 * ```
 *
 * The palette follows the page's theme out of the box; `dark` supplies the
 * paint to swap in while it is dark:
 *
 * ```vue
 * <MagnetCursor :color="light" :dark="{ color: '#f8fafc2e' }" />
 * ```
 */
export const MagnetCursor = defineComponent({
  name: 'MagnetCursor',
  props: {
    className: String,
    container: Object as PropType<HTMLElement>,
    lerp: Number,
    itemSelector: String,
    pinSelector: String as PropType<string | null>,
    colorAttribute: String,
    liquid: [Object, Boolean] as PropType<MagnetCursorOptions['liquid']>,
    trail: [Object, Boolean] as PropType<MagnetCursorOptions['trail']>,
    morph: [Object, Boolean] as PropType<MagnetCursorOptions['morph']>,
    threshold: Number,
    size: [Number, String] as PropType<number | string>,
    scale: Number,
    itemScale: Number,
    pinScale: Number,
    color: String,
    itemColor: String,
    blur: [Number, String] as PropType<number | string>,
    blendMode: String,
    zIndex: Number,
    theme: String as PropType<MagnetCursorOptions['theme']>,
    dark: Object as PropType<MagnetCursorOptions['dark']>,
    darkSelector: String,
    lightSelector: String,
    hideNativeCursor: { type: Boolean, default: undefined },
    detectPointer: { type: Boolean, default: undefined },
    respectReducedMotion: { type: Boolean, default: undefined },
    pauseOnHidden: { type: Boolean, default: undefined },
  },
  emits: {
    itemChange: (_active: boolean, _target: Element | null) => true,
  },
  setup(props, { emit }) {
    useMagnetCursor(() => {
      // Undefined props must not shadow the engine defaults.
      const options: MagnetCursorOptions = {
        onItemChange: (active, target) => emit('itemChange', active, target),
      }
      for (const [key, value] of Object.entries(props)) {
        if (value !== undefined) (options as Record<string, unknown>)[key] = value
      }
      return options
    })

    return () => null
  },
})

export default MagnetCursor
