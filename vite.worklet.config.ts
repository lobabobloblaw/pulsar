// Fallback loader F1 ONLY — not used while the primary `?worker&url` pattern holds.
// Builds the worklet as a self-contained IIFE into public/, which Vite then serves
// and copies into dist/, making dev, build, and preview byte-identical.
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/audio/worklet/apu-processor.ts',
      formats: ['iife'],
      name: 'PulsarWorklet',
      fileName: () => 'pulsar-apu-worklet.js',
    },
    outDir: 'public',
    emptyOutDir: false,
    target: 'chrome120',
    sourcemap: true,
  },
})
