import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type EnvironmentModuleNode, type Plugin } from 'vite'

const CROSS_ORIGIN_ISOLATION = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const

// AudioWorklet modules cannot be hot-replaced: addModule() is one-shot per processor
// name per AudioContext. Any change in the worklet's module graph forces a full reload.
const WORKLET_GRAPH = /\/src\/audio\/(core|dsp|timeline|protocol|worklet)\//

function workletFullReload(): Plugin {
  return {
    name: 'pulsar:worklet-full-reload',
    hotUpdate({ file, modules, timestamp }) {
      if (this.environment.name !== 'client') return
      if (!WORKLET_GRAPH.test(file.replaceAll('\\', '/'))) return
      const seen = new Set<EnvironmentModuleNode>()
      for (const m of modules) {
        this.environment.moduleGraph.invalidateModule(m, seen, timestamp, true)
      }
      this.environment.hot.send({ type: 'full-reload' })
      return []
    },
  }
}

export default defineConfig({
  plugins: [svelte(), workletFullReload()],
  server: { headers: CROSS_ORIGIN_ISOLATION, port: 5173, strictPort: true },
  preview: { headers: CROSS_ORIGIN_ISOLATION, port: 4173, strictPort: true },
  worker: { format: 'iife' },
  build: { target: 'chrome120', sourcemap: true, assetsInlineLimit: 0 },
})
