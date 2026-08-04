/* pulsar — entry (plan C2).
 *
 * Order matters: reset, then tokens (which also declares the one webfont), then
 * the room attribute, then mount. The room is applied to <html> BEFORE first
 * paint so a night-room user never sees a frame of the day slab.
 *
 * The JetBrains Mono Variable file comes from @fontsource-variable/jetbrains-mono,
 * but the @font-face rule is authored in design/tokens.css rather than imported
 * from the package: the package ships seven subsets at font-display: swap, and
 * an instrument that reflows its numerals mid-load reads as broken (D6). We take
 * the latin subset and font-display: block.
 */

import { mount } from 'svelte'
import './design/reset.css'
import './design/tokens.css'
import App from './App.svelte'

const stored = localStorage.getItem('pulsar.room')
const room =
  stored === 'night' || stored === 'day'
    ? stored
    : matchMedia('(prefers-color-scheme: dark)').matches
      ? 'night'
      : 'day'
document.documentElement.dataset['room'] = room

mount(App, { target: document.getElementById('app')! })
