<script>
  import Search from '@lucide/svelte/icons/search';
  import X from '@lucide/svelte/icons/x';
  import FunnelX from '@lucide/svelte/icons/funnel-x';
  import Heart from '@lucide/svelte/icons/heart';
  import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
  import Play from '@lucide/svelte/icons/play';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import { app, FORMATS, genres, decades, sagas, distributors } from '$lib/state.svelte.js';
  import SegmentedButton from './SegmentedButton.svelte';
  import Flag from './Flag.svelte';
  import ClearableSelect from './ClearableSelect.svelte';

  const languages = ['all', 'en', 'fr', 'other'];
  const subs = ['any', 'en', 'fr', 'none'];
  const picks = ['all', 'recommended', 'fave'];
  // French writes language names in lower case: capitalise them for buttons
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const languageLabel = (v) =>
    v === 'all'
      ? app.t('filter.all')
      : v === 'other'
        ? app.t('lang.other')
        : cap(app.languageName(v));
  const subsLabel = (v) =>
    v === 'any'
      ? app.t('filter.any')
      : v === 'none'
        ? app.t('subs.none')
        : cap(app.languageName(v));
  const picksLabel = (v) => (v === 'all' ? app.t('filter.all') : app.t(`picks.${v}`));
  const sagaList = $derived(
    [...sagas].sort((a, b) => a.name[app.lang].localeCompare(b.name[app.lang], app.lang))
  );

  // The bar sticks to the top of the window. `stuck` (the sentinel above it has scrolled away) only changes its look,
  // never its height: a height change right at the sticking point makes the page jump back and forth.
  let sentinel = $state();
  let stuck = $state(false);
  $effect(() => {
    const io = new IntersectionObserver(([e]) => (stuck = !e.isIntersecting));
    io.observe(sentinel);
    return () => io.disconnect();
  });

  // Phones: the groups drop down over the films, and fold away again once the page is scrolled down a little.
  let anchor = 0;
  function onscroll() {
    const y = window.scrollY;
    if (y < anchor || !app.filtersOpen) anchor = y;
    else if (y - anchor > 48 && matchMedia('(max-width: 700px)').matches) app.filtersOpen = false;
  }
</script>

<svelte:window {onscroll} />

<div class="sentinel" bind:this={sentinel} aria-hidden="true"></div>
<section
  class="filters card"
  class:stuck
  class:open={app.filtersOpen}
  aria-label={app.t('search.label')}
>
  <div class="top">
    <label class="search">
      <Search size={17} />
      <span class="sr">{app.t('search.label')}</span>
      <input
        type="search"
        placeholder={app.t('search.placeholder')}
        bind:value={app.query}
        autocomplete="off"
        spellcheck="false"
      />
      {#if app.query}
        <button
          type="button"
          class="clear"
          onclick={() => (app.query = '')}
          aria-label={app.t('search.clear')}
        >
          <X size={15} />
        </button>
      {/if}
    </label>
    <button
      class="toggle"
      aria-expanded={app.filtersOpen}
      aria-controls="filter-groups"
      onclick={() => (app.filtersOpen = !app.filtersOpen)}
    >
      <SlidersHorizontal size={16} />
      <span class="toggle-label">
        {app.t('filter.toggle')}
      </span>
      {#if app.activeFilters}
        <span class="n">{app.activeFilters}</span>
      {/if}
    </button>
  </div>

  <div class="groups" id="filter-groups" class:open={app.filtersOpen}>
    <div class="group">
      <span class="label">{app.t('filter.format')}</span>
      <div class="chips" role="group" aria-label={app.t('filter.format')}>
        {#each FORMATS as f (f)}
          <button
            class="chip"
            aria-pressed={app.formats.includes(f)}
            onclick={() => app.toggleFormat(f)}
          >
            {app.formatName(f)}
          </button>
        {/each}
        <button class="chip" aria-pressed={app.plex} onclick={() => (app.plex = !app.plex)}>
          <Play size={11} fill="currentColor" />
          {app.t('filter.plex')}
        </button>
      </div>
    </div>

    <div class="group">
      <span class="label">{app.t('filter.language')}</span>
      <SegmentedButton
        label={app.t('filter.language')}
        options={languages.map((v) => ({ value: v, label: languageLabel(v) }))}
        bind:value={app.language}
        option={flagOrText}
      />
    </div>

    <div class="group">
      <span class="label">{app.t('filter.subs')}</span>
      <SegmentedButton
        label={app.t('filter.subs')}
        options={subs.map((v) => ({ value: v, label: subsLabel(v) }))}
        bind:value={app.subs}
        option={flagOrText}
      />
    </div>

    <div class="group">
      <span class="label">{app.t('filter.picks')}</span>
      <SegmentedButton
        label={app.t('filter.picks')}
        options={picks.map((v) => ({ value: v, label: picksLabel(v) }))}
        bind:value={app.picks}
        option={pickIcon}
      />
    </div>

    <div class="group">
      <span class="label">{app.t('filter.more')}</span>
      <div class="selects">
        <ClearableSelect
          label={app.t('filter.genre')}
          options={genres.map((g) => ({ value: g, label: app.genreName(g) }))}
          bind:value={app.genre}
        />
        <ClearableSelect
          label={app.t('filter.decade')}
          options={decades.map((d) => ({ value: String(d), label: `${d}s` }))}
          bind:value={app.decade}
        />
        {#if sagas.length}
          <ClearableSelect
            label={app.t('filter.saga')}
            options={sagaList.map((s) => ({ value: s.id, label: app.sagaName(s.id) }))}
            value={app.saga}
            onchange={(v) => app.setSaga(v)}
          />
        {/if}
        {#if distributors.length}
          <ClearableSelect
            label={app.t('filter.distributor')}
            options={distributors.map((p) => ({ value: p, label: p }))}
            bind:value={app.distributor}
          />
        {/if}
        {#if app.activeFilters}
          <button class="reset" onclick={() => app.resetFilters()}>
            <FunnelX size={16} />
            <span class="reset-label">{app.t('filter.clear')}</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
</section>

{#snippet flagOrText(o)}
  {#if o.value === 'en' || o.value === 'fr'}
    <Flag code={o.value} size={17} />
  {:else}
    {o.label}
  {/if}
{/snippet}

{#snippet pickIcon(o)}
  {#if o.value === 'fave'}
    <Heart size={15} fill="currentColor" />
  {:else if o.value === 'recommended'}
    <ThumbsUp size={15} />
  {:else}
    {o.label}
  {/if}
{/snippet}

<style>
  .sentinel {
    height: 0;
  }
  .filters {
    position: sticky;
    top: 0;
    z-index: 40;
    padding: 14px 16px 16px;
    margin-bottom: 14px;
    transition:
      box-shadow 0.2s,
      border-radius 0.2s;
  }
  .stuck {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-top-color: transparent;
    box-shadow: 0 10px 28px #000a;
  }
  .top {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 14px;
  }
  .search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    background: #0a1030;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0 14px;
    color: var(--muted);
  }
  .search:focus-within {
    border-color: var(--gold);
  }
  input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    color: var(--text);
    font: inherit;
    font-size: 15px;
    padding: 9px 0;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }
  input::-webkit-search-cancel-button {
    display: none;
  }
  .clear {
    display: grid;
    place-items: center;
    background: none;
    border: 0;
    color: var(--muted);
    padding: 4px;
  }
  .clear:hover {
    color: var(--text);
  }
  .reset {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 0;
    color: var(--gold);
    font-size: 13px;
    white-space: nowrap;
    padding: 6px 4px 6px 6px;
  }
  .reset:hover .reset-label {
    text-decoration: underline;
  }
  .toggle {
    display: none;
    align-items: center;
    gap: 6px;
    background: #0a1030;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 8px 13px;
    color: var(--text);
    font-size: 13px;
    white-space: nowrap;
  }
  .toggle[aria-expanded='true'] {
    border-color: var(--gold);
  }
  .n {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--red);
    color: #fff;
    font: 700 11px/1 var(--sans);
  }
  .groups {
    display: flex;
    flex-wrap: wrap;
    gap: 14px 26px;
  }
  /* Phones: one compact row (search and filters); the groups drop down over the films instead of pushing them,
     so opening them never moves the page under a stuck bar. */
  @media (max-width: 700px) {
    .filters {
      padding: 10px 12px;
    }
    .top {
      margin-bottom: 0;
      gap: 8px;
    }
    .toggle {
      display: inline-flex;
      padding: 8px 11px;
    }
    /* open: the bar and the panel make one box (square bottom corners, no line between them) */
    .filters.open {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: transparent;
      box-shadow: none; /* the panel's shadow covers both: two would overlap darker beside the join */
    }
    .groups {
      position: absolute;
      left: -1px; /* over the bar's border, so the side borders line up */
      right: -1px;
      top: 100%;
      padding: 10px 12px 16px; /* the bar's side padding: the chips line up with the search field */
      background: var(--bg2);
      border: 1px solid var(--line);
      border-top: 0;
      border-radius: 0 0 16px 16px;
      box-shadow: 0 14px 28px #000a;
      /* the panel sits under the bar: without this, its shadow would darken the bar's lower edge */
      clip-path: inset(0 -48px -48px);
      max-height: min(70vh, 520px);
      overflow-y: auto;
      overscroll-behavior: contain;
      z-index: -1;
      transition:
        transform 0.22s cubic-bezier(0.3, 0.7, 0.2, 1),
        opacity 0.18s,
        visibility 0s;
    }
    .groups:not(.open) {
      transform: translateY(-12px);
      opacity: 0;
      visibility: hidden;
      transition:
        transform 0.18s,
        opacity 0.15s,
        visibility 0s 0.18s;
    }
  }
  @media (max-width: 380px) {
    .toggle-label {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .groups,
    .groups:not(.open) {
      transition: none;
    }
  }
  .group {
    display: flex;
    flex-direction: column;
    align-items: flex-start; /* a label wider than its control ("Coups de cœur de Tom") mustn't stretch it */
    gap: 6px;
    min-width: 0;
    max-width: 100%;
  }
  .label {
    font: 700 11px/1 var(--title);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #0a1030;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px 12px;
    color: var(--muted);
    font-size: 12.5px;
    white-space: nowrap;
    transition:
      background 0.18s,
      color 0.18s,
      border-color 0.18s;
  }
  .chip:hover:not([aria-pressed='true']) {
    color: var(--text);
    border-color: #3b4a8f;
  }
  .chip[aria-pressed='true'] {
    background: var(--red);
    border-color: var(--red);
    color: #fff;
  }
  .selects {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
