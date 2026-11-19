<script>
  // A select pill whose label is its empty choice ("Genre"), with a cross to go back to it once something is picked.
  // options: [{ value, label }]. Use bind:value, or pass onchange to handle the change yourself.
  import X from '@lucide/svelte/icons/x';
  import { app } from '$lib/state.svelte.js';

  let { value = $bindable(), onchange = undefined, label, options } = $props();

  function set(v) {
    if (onchange) onchange(v);
    else value = v;
  }
</script>

<span class="sel" class:set={value}>
  <label>
    <span class="sr">{label}</span>
    <select {value} onchange={(e) => set(e.currentTarget.value)}>
      <option value="">{label}</option>
      {#each options as o (o.value)}
        <option value={o.value}>{o.label}</option>
      {/each}
    </select>
  </label>
  {#if value}
    <button
      class="x"
      onclick={() => set('')}
      aria-label="{app.t('filter.unset')}: {label}"
      title={app.t('filter.unset')}
    >
      <X size={14} />
    </button>
  {/if}
</span>

<style>
  .sel {
    position: relative;
    display: inline-flex;
    min-width: 0;
    max-width: 100%;
  }
  label {
    display: contents;
  }
  /* something picked: the cross takes the arrow's place, and the pill is outlined like an active filter */
  .set select {
    background-image: none;
    border-color: var(--gold);
  }
  .x {
    position: absolute;
    right: 5px;
    top: 50%;
    translate: 0 -50%;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0; /* the browser's default button padding leaves less room than the icon, pushing it off centre */
    border-radius: 50%;
    border: 0;
    background: none;
    color: var(--muted);
    transition:
      background 0.15s,
      color 0.15s;
  }
  .x:hover,
  .x:focus-visible {
    background: #ffffff1a;
    color: var(--text);
  }
</style>
