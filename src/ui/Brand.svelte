<!--
  pulsar — wordmark (plan C1).

  The one place the webfont is allowed to be large. `2a03` is set as an
  equipment designation in a hairline box, which is the vernacular this product
  borrows from: the model number is printed on the faceplate, not in the manual.
  Lowercase throughout, authored lowercase — no text-transform anywhere.
-->
<script lang="ts">
  interface Props {
    /** Shown as the strapline; the status chips carry live state. */
    subtitle?: string
  }
  let { subtitle = 'nes voice synth' }: Props = $props()
</script>

<div class="brand">
  <h1 class="mark">pulsar</h1>
  <span class="model t-micro" aria-hidden="true">2a03</span>
  <p class="strap t-micro">{subtitle}</p>
</div>

<style>
  .brand {
    display: grid;
    grid-template-columns: auto auto;
    grid-template-rows: auto auto;
    align-items: center;
    justify-content: start;
    column-gap: var(--s-2);
    row-gap: 2px;
  }

  .mark {
    font-size: var(--t-brand-size);
    font-weight: var(--t-brand-weight);
    letter-spacing: var(--t-brand-track);
    line-height: 1;
    color: var(--enclosure-ink);
  }

  .model {
    align-self: center;
    padding: 2px var(--s-1);
    border: 1px solid var(--enclosure-hairline);
    border-radius: var(--r-1);
    color: var(--enclosure-ink-2);
    line-height: 1;
  }

  .strap {
    grid-column: 1 / -1;
    color: var(--enclosure-ink-2);
  }
</style>
