// M0 stub processor: proves the loader, the thread, and the render quantum.
// WP1 replaces the sine with the Apu2A03 core. Zero allocation in process().
const TWO_PI = 2 * Math.PI

class PulsarApuProcessor extends AudioWorkletProcessor {
  private phase = 0
  private readonly phaseInc = (TWO_PI * 440) / sampleRate

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channels = outputs[0]
    if (channels === undefined) return true
    const out = channels[0]
    if (out === undefined) return true

    let p = this.phase
    const inc = this.phaseInc
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.sin(p) * 0.1
      p += inc
      if (p >= TWO_PI) p -= TWO_PI
    }
    this.phase = p
    return true
  }
}

registerProcessor('pulsar-apu', PulsarApuProcessor)
