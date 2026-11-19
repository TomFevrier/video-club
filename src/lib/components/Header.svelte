<script>
  import Ticket from '@lucide/svelte/icons/ticket';
  import { app, movies, plexCount } from '$lib/state.svelte.js';
  import SegmentedButton from './SegmentedButton.svelte';
  const n = $derived(app.selection.length);
</script>

<header>
  <div class="bulbs" aria-hidden="true"></div>
  <div class="row">
    <div>
      <h1>{app.t('app.title')}</h1>
      <p>{app.t('app.subtitle')}</p>
      <p class="count">
        {app.t('app.stats', { films: app.fmt.int(movies.length), plex: app.fmt.int(plexCount) })}
      </p>
    </div>
    <div class="controls">
      <SegmentedButton
        label={app.t('lang')}
        options={[
          { value: 'en', label: 'EN' },
          { value: 'fr', label: 'FR' }
        ]}
        value={app.lang}
        onchange={(v) => app.setLang(v)}
      />
      <button
        class="ticket"
        onclick={() => (app.trayOpen = true)}
        aria-label="{app.t('tray.open')} ({n})"
        title={app.t('tray.open')}
      >
        <Ticket size={22} />
        {#if n}
          <span class="badge">{n > 99 ? '99+' : n}</span>
        {/if}
      </button>
    </div>
  </div>
</header>

<style>
  header {
    padding: 18px 0 18px;
  }
  .bulbs {
    height: 8px;
    margin-bottom: 18px;
    background: radial-gradient(circle at 6px 4px, var(--gold) 2.2px, transparent 2.8px) 0 0 / 18px
      8px repeat-x;
    opacity: 0.85;
    mask: linear-gradient(90deg, #000 60%, transparent);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
  }
  h1 {
    font: 800 clamp(32px, 6.4vw, 56px)/1 var(--title);
    letter-spacing: -0.01em;
    background: linear-gradient(95deg, #fff 30%, var(--gold));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  p {
    margin: 6px 0 0;
    color: var(--muted);
  }
  .count {
    margin-top: 2px;
    font-size: 13px;
  }
  .controls {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .ticket {
    position: relative;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #0a1030;
    border: 1px solid var(--line);
    color: var(--gold);
    transition: border-color 0.15s;
  }
  .ticket:hover {
    border-color: var(--gold);
  }
  .badge {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 19px;
    height: 19px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--red);
    color: #fff;
    font: 700 11px/19px var(--sans);
    text-align: center;
  }
</style>
