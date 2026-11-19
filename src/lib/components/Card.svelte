<script>
  import TicketPlus from '@lucide/svelte/icons/ticket-plus';
  import TicketCheck from '@lucide/svelte/icons/ticket-check';
  import Heart from '@lucide/svelte/icons/heart';
  import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
  import Play from '@lucide/svelte/icons/play';
  import Poster from './Poster.svelte';
  import { app } from '$lib/state.svelte.js';

  let { movie } = $props();
  const picked = $derived(app.isPicked(movie));
  const title = $derived(app.title(movie));
  const meta = $derived(
    [movie.year, movie.runtime && app.fmt.duration(movie.runtime)].filter(Boolean).join(' · ')
  );
</script>

<!-- Just the poster and its ticket; the rest slides in on hover (or keyboard focus), as in the first version.
     Touch screens have no hover: a tap opens the details. -->
<article class="film" id="m{movie.id}" class:picked class:flash={app.highlight === movie.id}>
  <button
    class="open"
    onclick={() => (app.detail = movie)}
    aria-label={app.t('card.open', { title })}
  >
    <Poster film={movie} />
    <span class="veil" aria-hidden="true">
      <span class="pills">
        {#each movie.formats as f (f)}
          <span class="pill" class:k4={f === '4K'}>{f}</span>
        {/each}
        {#if movie.plex}
          <span class="pill"><Play size={9} fill="currentColor" />Plex</span>
        {/if}
      </span>
      <span class="info">
        <span class="title">
          {title}
          {#if movie.tier === 'fave'}
            <span class="tier fave">
              <Heart size={12} fill="currentColor" />
            </span>
          {:else if movie.tier === 'recommended'}
            <span class="tier rec">
              <ThumbsUp size={12} />
            </span>
          {/if}
        </span>
        <span class="meta">{meta}</span>
        {#if movie.directors.length}
          <span class="meta dir">{movie.directors.join(', ')}</span>
        {/if}
      </span>
    </span>
  </button>

  <button
    class="pick"
    aria-pressed={picked}
    onclick={() => app.toggle(movie)}
    aria-label="{picked ? app.t('card.remove') : app.t('card.add')}: {title}"
    title={picked ? app.t('card.remove') : app.t('card.add')}
  >
    {#if picked}
      <TicketCheck size={19} />
    {:else}
      <TicketPlus size={19} />
    {/if}
  </button>
</article>

<style>
  .film {
    position: relative;
    cursor: pointer; /* the whole card reacts to hover; the poster button covers it */
    min-width: 0;
    border-radius: 8px;
    box-shadow: 0 4px 14px #0007;
    outline: 2px solid transparent;
    outline-offset: 2px;
    transition:
      outline-color 0.18s,
      transform 0.18s;
  }
  .picked {
    outline-color: var(--gold);
  }
  .film:has(:focus-visible) {
    outline-color: #fff;
  }
  .open {
    position: relative;
    display: block;
    width: 100%;
    background: none;
    border: 0;
    padding: 0;
    color: inherit;
    text-align: left;
    border-radius: 8px;
    overflow: hidden;
  }
  .open :global(.poster) {
    border-radius: 0;
    transition:
      transform 0.35s cubic-bezier(0.3, 0.7, 0.2, 1),
      filter 0.35s;
  }

  /* the overlay: a dark gradient, pills sliding down from the top, the text up from the bottom */
  .veil {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 7px;
    background: linear-gradient(180deg, #04061acc 0%, #04061a33 30%, #04061a40 50%, #04061af2 100%);
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-right: 40px; /* the ticket */
    transform: translateY(-8px);
    transition: transform 0.3s cubic-bezier(0.3, 0.7, 0.2, 1);
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: #070b1ccc;
    border: 1px solid #ffffff2e;
    border-radius: 999px;
    padding: 1px 7px;
    font: 700 10.5px/1.5 var(--sans);
    letter-spacing: 0.03em;
    color: #fff;
  }
  .pill.k4 {
    color: var(--gold);
    border-color: #eab62f80;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    transform: translateY(10px);
    transition: transform 0.3s cubic-bezier(0.3, 0.7, 0.2, 1);
  }
  .title {
    font: 700 14px/1.2 var(--title);
    color: #fff;
    text-wrap: balance;
  }
  .tier {
    display: inline-block;
    vertical-align: -1px;
    margin-left: 2px;
  }
  .tier.fave {
    color: #ff7a7a;
  }
  .tier.rec {
    color: var(--gold);
  }
  .meta {
    font-size: 11.5px;
    line-height: 1.3;
    color: #d5daf0;
  }
  .dir {
    color: var(--muted);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  @media (hover: hover) {
    .film:hover {
      transform: translateY(-2px);
    }
    .film:hover .open :global(.poster) {
      transform: scale(1.06);
      filter: brightness(0.75);
    }
    .film:hover .veil {
      opacity: 1;
    }
    .film:hover .pills,
    .film:hover .info {
      transform: none;
    }
  }
  .film:has(:focus-visible) .veil {
    opacity: 1;
  }
  .film:has(:focus-visible) .pills,
  .film:has(:focus-visible) .info {
    transform: none;
  }

  .pick {
    position: absolute;
    right: 6px;
    top: 6px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #070b1ccc;
    border: 1px solid #ffffff40;
    color: #fff;
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    transition:
      background 0.15s,
      color 0.15s,
      border-color 0.15s,
      transform 0.15s;
  }
  .pick:hover {
    transform: scale(1.08);
    border-color: var(--gold);
  }
  .pick[aria-pressed='true'] {
    background: var(--gold);
    border-color: var(--gold);
    color: #1b1400;
  }

  .flash {
    animation: flash 0.7s ease-in-out 3;
  }
  @keyframes flash {
    50% {
      outline-color: var(--gold);
      transform: scale(1.04);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .film,
    .flash,
    .veil,
    .pills,
    .info,
    .open :global(.poster) {
      transition: none;
      animation: none;
    }
    .flash {
      outline-color: var(--gold);
    }
  }
</style>
