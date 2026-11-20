<script>
  import { onMount } from 'svelte';
  import Dices from '@lucide/svelte/icons/dices';
  import Ticket from '@lucide/svelte/icons/ticket';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import { fade, fly } from 'svelte/transition';
  import config from '../../../config.json';
  import og from '$lib/data/og.json';
  import { app, generatedAt, sortOptions } from '$lib/state.svelte.js';
  import Header from '$lib/components/Header.svelte';
  import Filters from '$lib/components/Filters.svelte';
  import Card from '$lib/components/Card.svelte';
  import Detail from '$lib/components/Detail.svelte';
  import Tray from '$lib/components/Tray.svelte';
  import ScrollIndicator from '$lib/components/ScrollIndicator.svelte';

  /** The language this page is for (the /fr/ page); the main page picks one from ?lang= or the browser. */
  let { lang = null } = $props();
  // set before the first render, so the prerendered HTML (and its <meta> tags) is in the page's language
  // svelte-ignore state_referenced_locally
  app.lang = lang ?? 'en';
  const card = $derived(og[app.lang]);
  const site = og.siteUrl || config.siteUrl;
  // svelte-ignore state_referenced_locally
  const url = site && site + (lang === 'fr' ? 'fr/' : '');

  onMount(() => app.init(lang));
  const updated = $derived(app.fmt.date(new Date(generatedAt)));
  const n = $derived(app.selection.length);

  let scrollY = $state(0);
  let viewport = $state(800);
  // shown once the page has scrolled past a screen and a half
  const farDown = $derived(scrollY > viewport * 1.5);
  // the header (and its ticket button) has scrolled out of sight
  let headerHeight = $state(200);
  const pastHeader = $derived(scrollY > headerHeight);
  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
</script>

<svelte:head>
  <title>{app.t('app.title')}</title>
  <meta name="description" content={app.t('app.description')} />
  {#if site}
    <link rel="canonical" href={url} />
    <link rel="alternate" hreflang="en" href={site} />
    <link rel="alternate" hreflang="fr" href="{site}fr/" />
    <link rel="alternate" hreflang="x-default" href={site} />
  {/if}
  <!-- social previews: crawlers don't run scripts, they read the prerendered HTML (one page per language) -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={app.t('app.title')} />
  <meta property="og:title" content={app.t('app.title')} />
  <meta property="og:description" content={app.t('app.description')} />
  <meta property="og:locale" content={app.lang === 'fr' ? 'fr_FR' : 'en_GB'} />
  <meta property="og:locale:alternate" content={app.lang === 'fr' ? 'en_GB' : 'fr_FR'} />
  {#if url}
    <meta property="og:url" content={url} />
  {/if}
  {#if site && card?.file}
    <meta property="og:image" content={site + card.file} />
    <meta property="og:image:width" content={og.width} />
    <meta property="og:image:height" content={og.height} />
    <meta property="og:image:alt" content={card.alt} />
    <meta name="twitter:card" content="summary_large_image" />
  {:else}
    <meta name="twitter:card" content="summary" />
  {/if}
</svelte:head>

<svelte:window
  bind:scrollY
  bind:innerHeight={viewport}
  onkeydown={(e) => {
    if (e.key !== 'Escape') return;
    if (app.detail) app.detail = null;
    else if (app.trayOpen) app.trayOpen = false;
    else if (app.filtersOpen) app.filtersOpen = false;
  }}
/>

<div class="page">
  <div bind:clientHeight={headerHeight}><Header /></div>
  <Filters />

  <div class="bar">
    <p class="count">{app.t('results.count', { n: app.visible.length })}</p>
    <div class="tools">
      <label class="sel">
        <span class="sr">{app.t('sort.label')}</span>
        <select bind:value={app.sort}>
          {#each sortOptions as s (s)}
            <option value={s}>
              {app.t('sort.by', { sort: app.t(`sort.${s}`) })}
            </option>
          {/each}
        </select>
      </label>
      <!-- the dice alone; the words unroll on hover or keyboard focus (and stay readable to screen readers) -->
      <button class="surprise" onclick={() => app.surprise()} disabled={!app.visible.length}>
        <span class="dice"><Dices size={17} /></span>
        <span class="words"><span>{app.t('surprise')}</span></span>
      </button>
    </div>
  </div>

  {#if app.visible.length}
    <div class="grid-films">
      {#each app.visible as movie (movie.id)}
        <Card {movie} />
      {/each}
    </div>
  {:else}
    <p class="empty">{app.t('results.empty')}</p>
  {/if}

  <footer>
    <p class="legal">
      {#each app.t('footer.tmdb').split('\n') as line (line)}
        <span class="line">{line}</span>
      {/each}
    </p>
    <p>{app.t('updated', { date: updated })}</p>
  </footer>
</div>

{#if farDown}
  <button
    class="top"
    onclick={toTop}
    aria-label={app.t('top')}
    title={app.t('top')}
    transition:fly={{ y: 16, duration: 200 }}
  >
    <ArrowUp size={20} />
  </button>
{/if}

<!-- With films in it: the gold pill, everywhere. Empty: on phones only, once the header's ticket is out of sight. -->
{#if (n || pastHeader) && !app.trayOpen && !app.detail}
  <button
    class="pill-tray"
    class:empty={!n}
    onclick={() => (app.trayOpen = true)}
    aria-label={n ? undefined : app.t('tray.open')}
    transition:fade={{ duration: 150 }}
  >
    <Ticket size={18} />
    {#if n}
      <span>{app.t('tray.pill', { n })}</span>
      <b>{app.t('tray.view')}</b>
    {:else}
      <span>{app.t('tray.title')}</span>
    {/if}
  </button>
{/if}

<Detail />
<Tray />
<ScrollIndicator />

{#if app.toast}
  <div class="toast" role="status">{app.toast}</div>
{/if}

<style>
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px 20px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .count {
    margin: 0;
    color: var(--muted);
  }
  .tools {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .surprise {
    display: inline-flex;
    align-items: center;
    height: 34px;
    background: linear-gradient(135deg, var(--red), #6a2a8a);
    border: 0;
    border-radius: 999px;
    padding: 0 8.5px;
    color: #fff;
    font-weight: 700;
    font-size: 13px;
    transition:
      padding 0.3s cubic-bezier(0.3, 0.7, 0.2, 1),
      box-shadow 0.3s;
  }
  .dice {
    display: grid;
    transition: transform 0.45s cubic-bezier(0.3, 1.4, 0.5, 1);
  }
  /* 0fr -> 1fr: the words' own width, animated, without measuring them */
  .words {
    display: grid;
    grid-template-columns: 0fr;
    transition: grid-template-columns 0.3s cubic-bezier(0.3, 0.7, 0.2, 1);
  }
  .words span {
    overflow: hidden;
    white-space: nowrap;
    padding-left: 0;
    opacity: 0;
    transition:
      padding 0.3s cubic-bezier(0.3, 0.7, 0.2, 1),
      opacity 0.2s;
  }
  .surprise:is(:hover, :focus-visible):not(:disabled) {
    padding-right: 15px;
    box-shadow: 0 4px 18px #b2222266;
  }
  .surprise:is(:hover, :focus-visible):not(:disabled) .words {
    grid-template-columns: 1fr;
  }
  .surprise:is(:hover, :focus-visible):not(:disabled) .words span {
    padding-left: 7px;
    opacity: 1;
  }
  .surprise:is(:hover, :focus-visible):not(:disabled) .dice {
    transform: rotate(-200deg);
  }
  .surprise:active:not(:disabled) .dice {
    transform: rotate(-380deg) scale(0.9);
  }
  .surprise:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  @media (prefers-reduced-motion: reduce) {
    .surprise,
    .dice,
    .words,
    .words span {
      transition: none;
    }
  }
  .grid-films {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 18px 16px;
  }
  /* phones: three posters per row, like the log in film-diary */
  @media (max-width: 640px) {
    .grid-films {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
  }
  .top {
    position: fixed;
    z-index: 70;
    right: 18px;
    bottom: 18px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #121b45e6;
    border: 1px solid #3b4a8f;
    color: var(--text);
    box-shadow: 0 8px 24px #000a;
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    transition:
      border-color 0.15s,
      color 0.15s;
  }
  .top:hover {
    border-color: var(--gold);
    color: var(--gold);
  }
  footer {
    margin-top: 36px;
    color: var(--muted);
    font-size: 12px;
    text-align: center;
    max-width: 720px;
    margin-inline: auto;
  }
  .line {
    display: block;
  }
  footer p {
    margin: 4px 0;
  }
  .pill-tray {
    position: fixed;
    z-index: 70;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: var(--gold);
    color: #1b1400;
    border: 0;
    border-radius: 999px;
    padding: 11px 18px;
    font-size: 14px;
    box-shadow: 0 8px 28px #000a;
    white-space: nowrap;
  }
  .pill-tray.empty {
    background: #121b45e6;
    color: var(--gold);
    border: 1px solid #3b4a8f;
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    font-weight: 700;
  }
  @media (min-width: 641px) {
    .pill-tray.empty {
      display: none; /* the header's ticket is enough on wider screens */
    }
  }
  .pill-tray b {
    font-weight: 800;
    border-left: 1px solid #1b140040;
    padding-left: 10px;
  }
  .toast {
    position: fixed;
    z-index: 120;
    left: 50%;
    bottom: 78px;
    transform: translateX(-50%);
    max-width: calc(100vw - 32px);
    background: #121b45;
    border: 1px solid #3b4a8f;
    border-radius: 12px;
    padding: 10px 16px;
    font-size: 13.5px;
    box-shadow: 0 8px 28px #000a;
  }
</style>
