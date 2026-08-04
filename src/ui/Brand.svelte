<!--
  pulsar — wordmark (plan C1, compact pass 2026-08-04).

  The one place the webfont is allowed to be large. `2a03` is set as an
  equipment designation in a hairline box, which is the vernacular this product
  borrows from: the model number is printed on the faceplate, not in the manual.
  The strapline is gone with the face-stripping pass — a device wears a badge,
  not a tagline. Lowercase throughout, authored lowercase — no text-transform
  anywhere on the slab.
-->
<script lang="ts">
  // No props: the strapline left with the face-stripping pass, and the badge
  // needs nothing configurable. The empty block keeps the component typed.
</script>

<div class="brand">
  <h1 class="mark">pulsar</h1>
  <span class="model t-micro" aria-hidden="true">2a03</span>
</div>

<style>
  .brand {
    display: flex;
    align-items: center;
    gap: var(--s-2);
  }

  .mark {
    font-size: var(--t-brand-size);
    font-weight: var(--t-brand-weight);
    letter-spacing: var(--t-brand-track);
    line-height: 1;
    color: var(--enclosure-ink);
  }

  .model {
    padding: 2px var(--s-1);
    border: 1px solid var(--enclosure-hairline);
    border-radius: var(--r-1);
    color: var(--enclosure-ink-2);
    line-height: 1;
  }
</style>
