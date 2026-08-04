// The ONE place the worklet loader pattern lives. If the primary `?worker&url`
// pattern fails the M0 gate (dev, build+preview, hard reload), switch to fallback
// F1: run `pnpm worklet:build` and export '/pulsar-apu-worklet.js' instead.
import url from '../worklet/apu-processor.ts?worker&url'

export const APU_WORKLET_URL: string = url
export const APU_PROCESSOR_NAME = 'pulsar-apu'
