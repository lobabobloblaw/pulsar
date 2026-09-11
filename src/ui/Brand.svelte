<!--
  pulsar — wordmark (Ivory).

  The one place the UI sans is allowed to be large: a 36px lowercase wordmark,
  tightly tracked, and beside it the model designation `2A03` in the mono at
  11px inside a one-pixel ink box — the way a faceplate prints its model
  number. The badge is decoration on a heading that already names the
  product, so it is hidden from the tree.
-->
<script lang="ts">
  // No props: the badge needs nothing configurable. The empty block keeps the
  // component typed.
</script>

<div class="brand">
  <h1 class="mark">pulsar</h1>
  <span class="model" aria-hidden="true">2A03</span>
</div>

<style>
  .brand {
    display: flex;
    align-items: center;
    gap: var(--s-3);
  }

  .mark {
    font-family: var(--font-sans);
    /* The phone head shrinks the wordmark so brand · output · settings share
       one row: Enclosure.svelte sets --brand-size there. */
    font-size: var(--brand-size, var(--t-brand-size));
    font-weight: var(--t-brand-weight);
    letter-spacing: var(--t-brand-track);
    line-height: 1;
    color: var(--enclosure-ink);
  }

  .model {
    padding: 5px;
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: 1px;
    color: var(--enclosure-ink);
    border: 1px solid var(--enclosure-ink);
  }
</style>
