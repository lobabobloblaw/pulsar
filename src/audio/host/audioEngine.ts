import { APU_PROCESSOR_NAME, APU_WORKLET_URL } from './workletUrl'

export interface EngineHandle {
  readonly ctx: AudioContext
  readonly node: AudioWorkletNode
  dispose(): Promise<void>
}

/** Must be called from a user gesture (autoplay policy). A fresh AudioContext per
 *  start — addModule() is one-shot per processor name per context, so dispose()
 *  fully closes the context and the cache-busted URL keeps reloads deterministic. */
export async function startEngine(): Promise<EngineHandle> {
  const ctx = new AudioContext({ latencyHint: 'interactive' })
  const sep = APU_WORKLET_URL.includes('?') ? '&' : '?'
  await ctx.audioWorklet.addModule(`${APU_WORKLET_URL}${sep}v=${Date.now()}`)
  const node = new AudioWorkletNode(ctx, APU_PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  })
  node.connect(ctx.destination)
  if (ctx.state === 'suspended') await ctx.resume()
  return {
    ctx,
    node,
    async dispose() {
      node.disconnect()
      await ctx.close()
    },
  }
}
