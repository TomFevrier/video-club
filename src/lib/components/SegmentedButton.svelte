<script>
  // A row of mutually exclusive options; a pill slides under the selected one.
  // options: [{ value, label }]. Use bind:value, or pass onchange to handle the switch yourself.
  // `option` (a snippet taking an option) draws a button's content instead of its label, e.g. a flag or an icon;
  // the label then stays as the button's accessible name and tooltip.
  let { options, value = $bindable(), onchange, label, option = undefined } = $props();

  let el = $state();
  let pill = $state(null); // position of the selected button, null until measured
  let ready = $state(false); // transitions on only after the first placement, so the pill doesn't fly in

  function place() {
    const on = el?.querySelector('[aria-pressed="true"]');
    pill = on ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight } : null;
  }

  // re-measure after the selection or the labels change (effects run once the DOM is updated)
  $effect(() => {
    value;
    options;
    place();
  });

  // ...and when anything resizes: fonts loading, window resize
  $effect(() => {
    options;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    for (const b of el.children) ro.observe(b);
    return () => ro.disconnect();
  });

  $effect(() => {
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => (ready = true))));
    return () => cancelAnimationFrame(id);
  });

  function select(v) {
    if (onchange) onchange(v);
    else value = v;
  }
</script>

<div
  class="seg"
  class:measured={pill}
  class:ready
  bind:this={el}
  role="group"
  aria-label={label}
  style:--x={pill && `${pill.x}px`}
  style:--y={pill && `${pill.y}px`}
  style:--w={pill && `${pill.w}px`}
  style:--h={pill && `${pill.h}px`}
>
  {#each options as o (o.value)}
    <button
      aria-pressed={value === o.value}
      onclick={() => select(o.value)}
      aria-label={option ? o.label : undefined}
      title={option ? o.label : undefined}
    >
      {#if option}
        {@render option(o)}
      {:else}
        {o.label}
      {/if}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    background: #0a1030;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2px;
    gap: 2px;
    flex-wrap: nowrap;
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    position: relative;
  }
  .seg::-webkit-scrollbar {
    display: none;
  }
  .seg::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: var(--w, 0px);
    height: var(--h, 0px);
    transform: translate(var(--x, 0px), var(--y, 0px));
    border-radius: 999px;
    background: var(--red);
    opacity: 0;
    pointer-events: none;
  }
  .seg.measured::before {
    opacity: 1;
  }
  .seg.ready::before {
    transition:
      transform 0.26s cubic-bezier(0.3, 0.7, 0.2, 1),
      width 0.26s cubic-bezier(0.3, 0.7, 0.2, 1),
      height 0.26s cubic-bezier(0.3, 0.7, 0.2, 1),
      opacity 0.15s;
  }
  button {
    background: transparent;
    border: 0;
    padding: 4px 11px;
    border-radius: 999px;
    color: var(--muted);
    font-size: 12.5px;
    white-space: nowrap;
    flex: none;
    position: relative; /* above the sliding pill */
    transition: color 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  button[aria-pressed='true'] {
    color: #fff;
  }
  /* before the pill is placed (server render, no JS), the selected button paints its own background */
  .seg:not(.measured) button[aria-pressed='true'] {
    background: var(--red);
  }
  button:hover:not([aria-pressed='true']) {
    color: var(--text);
  }
  @media (prefers-reduced-motion: reduce) {
    .seg.ready::before,
    button {
      transition: none;
    }
  }
</style>
