<script>
  // Round flag of a language (circle-flags, via scripts/sync.mjs, which keeps only the catalogue's languages).
  // Nothing is rendered for a language without a flag: put its name next to it.
  import flags from '$lib/data/flags.json';
  let { code, size = 16, title = undefined } = $props();
  // Every circle-flags SVG uses the same id for its round mask. With several flags on the page, all of them would point
  // at the first one's mask, and draw nothing when that flag is hidden (the folded filters on phones). Each instance
  // renames its ids with an id of its own.
  const uid = $props.id();
  const svg = $derived(
    flags[code]?.replace(
      /(id="|url\(#|href="#)([^")]+)/g,
      (_, prefix, id) => `${prefix}${uid}-${id}`
    )
  );
</script>

{#if svg}
  <span
    class="flag"
    style:--size="{size}px"
    {title}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : 'true'}
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the circle-flags package at sync time -->
    {@html svg}
  </span>
{/if}

<style>
  .flag {
    display: inline-block;
    flex: none;
    width: var(--size);
    height: var(--size);
    line-height: 0;
    vertical-align: -0.15em;
    border-radius: 50%;
    box-shadow: 0 0 0 1px #ffffff26;
  }
  .flag :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
