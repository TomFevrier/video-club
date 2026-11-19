<script>
  import X from '@lucide/svelte/icons/x';
  import Heart from '@lucide/svelte/icons/heart';
  import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
  import TicketPlus from '@lucide/svelte/icons/ticket-plus';
  import TicketCheck from '@lucide/svelte/icons/ticket-check';
  import Play from '@lucide/svelte/icons/play';
  import AudioLines from '@lucide/svelte/icons/audio-lines';
  import Captions from '@lucide/svelte/icons/captions';
  import CaptionsOff from '@lucide/svelte/icons/captions-off';
  import Poster from './Poster.svelte';
  import Logo from './Logo.svelte';
  import Flag from './Flag.svelte';
  import { app } from '$lib/state.svelte.js';

  const m = $derived(app.detail);
  const close = () => (app.detail = null);
  const subs = $derived(m ? ['en', 'fr'].filter((l) => m.subtitles[l]) : []);
  // HDR is a property of the 4K disc: it rides on that pill ("4K · DV") instead of having its own row
  const HDR_SHORT = { 'Dolby Vision': 'DV', HDR10: 'HDR10' };
  const formatLabel = (f) =>
    f === '4K' && m.hdr ? `${app.formatName(f)} · ${HDR_SHORT[m.hdr] ?? m.hdr}` : app.formatName(f);
  // French writes language names in lower case
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const picked = $derived(m ? app.isPicked(m) : false);
  // with typographic apostrophes, like the titles: "d'Amélie" isn't a different title from "d’Amélie"
  const original = $derived(m?.originalTitle?.replace(/'/g, '’'));
  // under the title: the year, then the original title (when it differs)
  const sub = $derived(
    m &&
      [
        m.year,
        original && original !== app.title(m) ? app.t('detail.original', { title: original }) : null
      ]
        .filter(Boolean)
        .join(' · ')
  );
</script>

{#if m}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="back" onclick={(e) => e.target === e.currentTarget && close()}>
    <div class="dlg" role="dialog" aria-modal="true" aria-label={app.title(m)}>
      <button class="x" onclick={close} aria-label={app.t('detail.close')}><X size={22} /></button>

      <div class="poster-col">
        <Poster film={m} size="w342" />
        <div class="links">
          <a
            href={m.boxdId
              ? `https://boxd.it/${m.boxdId}`
              : `https://letterboxd.com/tmdb/${m.tmdbId}/`}
            target="_blank"
            rel="noopener"
            title={app.t('detail.letterboxd')}
            aria-label={app.t('detail.letterboxd')}
          >
            <Logo name="letterboxd" height={14} />
          </a>
          <a
            href="https://www.themoviedb.org/movie/{m.tmdbId}"
            target="_blank"
            rel="noopener"
            title={app.t('detail.tmdb')}
            aria-label={app.t('detail.tmdb')}
          >
            <Logo name="tmdb" height={10} />
          </a>
        </div>
      </div>

      <div class="head">
        <h3>{app.title(m)}</h3>
        {#if sub}
          <div class="orig">{sub}</div>
        {/if}

        <div class="tags">
          {#each m.formats as f (f)}
            <span class="tag" class:k4={f === '4K'} title={f === '4K' && m.hdr ? m.hdr : undefined}>
              {formatLabel(f)}
            </span>
          {/each}
          {#if m.plex}
            <span class="tag"><Play size={11} fill="currentColor" />{app.t('badge.plex')}</span>
          {/if}
          {#if m.tier === 'fave'}
            <span class="tag fave">
              <Heart size={13} fill="currentColor" />{app.t('badge.fave')}
            </span>
          {:else if m.tier === 'recommended'}
            <span class="tag rec"><ThumbsUp size={13} />{app.t('badge.recommended')}</span>
          {/if}
        </div>
      </div>

      <div class="body">
        <dl>
          {#if m.runtime}
            <dt>{app.t('detail.runtime')}</dt>
            <dd>{app.fmt.duration(m.runtime)}</dd>
          {/if}
          {#if m.directors.length}
            <dt>{app.t('detail.directors')}</dt>
            <dd>{m.directors.join(', ')}</dd>
          {/if}
          {#if m.genres.length}
            <dt>{app.t('detail.genres')}</dt>
            <dd>{m.genres.map(app.genreName).join(', ')}</dd>
          {/if}
          <!-- spoken language, then the subtitles as flags (their names in the tooltips) -->
          <dt>{app.t('detail.languages')}</dt>
          <dd class="langs">
            {#if m.language}
              <span class="lang">
                <span class="ico" title={app.t('detail.spoken')}>
                  <AudioLines size={15} aria-label={app.t('detail.spoken')} />
                </span>
                <Flag code={m.language} />
                {cap(app.languageName(m.language))}
              </span>
            {/if}
            {#if subs.length}
              <span class="lang">
                <span class="ico" title={app.t('detail.subs')}>
                  <Captions size={15} aria-label={app.t('detail.subs')} />
                </span>
                {#each subs as l (l)}
                  <Flag code={l} title={cap(app.languageName(l))} />
                {/each}
              </span>
            {:else}
              <span class="lang muted">
                <CaptionsOff size={15} aria-hidden="true" />
                {app.t('detail.noSubs')}
              </span>
            {/if}
          </dd>
        </dl>

        <button class="add" class:on={picked} onclick={() => app.toggle(m)}>
          {#if picked}
            <TicketCheck size={18} />{app.t('card.remove')}
          {:else}
            <TicketPlus size={18} />{app.t('card.add')}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .back {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: #04061acc;
    backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
    place-items: safe center; /* taller than the screen: scrolls from its top instead of losing it */
    padding: 16px;
    overflow: auto;
  }
  .dlg {
    position: relative;
    display: grid;
    /* desktop: the poster on the left, the heading and the details beside it, no taller than the poster */
    grid-template-columns: 170px 1fr;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'poster head'
      'poster body';
    gap: 0 18px;
    max-width: 640px; /* as in cine-stats */
    width: 100%;
    background: linear-gradient(180deg, var(--card), var(--bg2));
    border: 1px solid #3b4a8f;
    border-radius: 16px;
    padding: 18px;
  }
  /* phones: one column, as in cine-stats: the poster, then the heading, then the details */
  @media (max-width: 520px) {
    .dlg {
      grid-template-columns: 1fr;
      grid-template-rows: auto;
      grid-template-areas:
        'poster'
        'head'
        'body';
      gap: 14px;
      padding: 16px;
    }
    .poster-col {
      max-width: 170px;
    }
    .head .tags {
      margin-bottom: 0; /* the grid's gap is enough */
    }
  }
  .head {
    grid-area: head;
    min-width: 0;
  }
  .body {
    grid-area: body;
    min-width: 0;
  }
  .x {
    position: absolute;
    top: 10px;
    right: 12px;
    background: none;
    border: 0;
    color: var(--muted);
    display: grid;
    place-items: center;
    padding: 2px;
  }
  .x:hover {
    color: var(--text);
  }
  .poster-col {
    grid-area: poster;
    position: relative;
    align-self: start;
  }
  .links {
    position: absolute;
    left: 8px;
    bottom: 8px;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 6px;
  }
  .links a {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    padding: 0 7px;
    border-radius: 999px;
    background: #070b1ccc;
    border: 1px solid #ffffff26;
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    transition:
      background 0.12s,
      border-color 0.12s;
  }
  .links a:hover {
    background: #121b45;
    border-color: #ffffff59;
  }
  h3 {
    font: 800 22px/1.15 var(--title);
    padding-right: 24px;
  }
  .orig {
    margin-top: 2px;
    font-size: 13px;
    color: var(--muted);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #0a1030;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 12.5px;
  }
  .tag.k4 {
    color: var(--gold);
    border-color: #eab62f80;
  }
  .tag.fave {
    color: #ff7a7a;
  }
  .tag.rec {
    color: var(--gold);
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1px 14px;
    margin: 0 0 16px; /* room above the button */
    font-size: 13.5px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
  .langs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 14px;
  }
  .lang {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .ico {
    display: inline-flex;
    color: var(--muted);
    margin-right: 1px;
  }
  .add {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--red);
    border: 1px solid var(--red);
    color: #fff;
    border-radius: 999px;
    padding: 8px 16px;
    font-weight: 700;
    font-size: 13.5px;
    transition: background 0.15s;
  }
  .add:hover {
    background: var(--red-hi);
  }
  .add.on {
    background: var(--gold);
    border-color: var(--gold);
    color: #1b1400;
  }
</style>
