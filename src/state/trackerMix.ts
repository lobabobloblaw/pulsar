/** Stored mute choices are suspended while solo is active, then restored. */
export function effectiveChannelMute(
  muted: readonly boolean[],
  soloChannel: number,
  channel: number,
): boolean {
  return soloChannel === -1 ? muted[channel] === true : soloChannel !== channel
}
