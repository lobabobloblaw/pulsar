/* pulsar — the phone's two pages (phone-pages, 2026-09-10).
 *
 * Below App's compact threshold the workspace switch pages the instrument
 * instead of stacking it two screens tall: `play` is the transport, the
 * keytop and the keybed; `voice` is the transport, the screen well and the
 * dials. Session state only, owned by App.svelte like `compact` — never
 * persisted, never in the tracker store. The tracker stays a wide surface.
 */
export type PhonePage = 'play' | 'voice'
