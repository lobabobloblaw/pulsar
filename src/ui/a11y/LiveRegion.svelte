<!--
  pulsar — the single polite live region (plan C2/C8).

  One region for the whole app. Playing a chord must not produce four
  announcements, so updates are throttled: the newest message wins and is
  committed at most once per `throttle` ms. That is why the throttle lives here
  and not in the callers — the callers do not know about each other.
-->
<script lang="ts">
  interface Props {
    message: string
    /** C8: the keybed announces at most one note per 400 ms. */
    throttle?: number
  }

  let { message, throttle = 400 }: Props = $props()

  let shown = $state('')
  let lastAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    const next = message
    const now = performance.now()
    const wait = throttle - (now - lastAt)

    if (wait <= 0) {
      lastAt = now
      shown = next
      return
    }

    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      lastAt = performance.now()
      shown = next
      timer = null
    }, wait)

    return () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }
  })
</script>

<div class="sr" role="status" aria-live="polite" aria-atomic="true">{shown}</div>
