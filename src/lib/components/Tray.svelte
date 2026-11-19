<script>
  import X from '@lucide/svelte/icons/x';
  import Trash from '@lucide/svelte/icons/trash';
  import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
  import Ticket from '@lucide/svelte/icons/ticket';
  import { fade, fly } from 'svelte/transition';
  import { cubicIn, quintOut } from 'svelte/easing';
  import Poster from './Poster.svelte';
  import { app } from '$lib/state.svelte.js';

  // Opening: the panel glides in from the edge and settles; the films follow, one after the other. Closing is quicker
  // and accelerates away. Reduced motion: no movement, a short fade only.
  const still = () =>
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const panelIn = (node) =>
    still()
      ? fade(node, { duration: 120 })
      : fly(node, { x: '100%', duration: 420, easing: quintOut, opacity: 1 });
  const panelOut = (node) =>
    still()
      ? fade(node, { duration: 100 })
      : fly(node, { x: '100%', duration: 240, easing: cubicIn, opacity: 1 });
  const itemIn = (node, i) =>
    still()
      ? { duration: 0 }
      : fly(node, { x: 24, duration: 360, delay: 90 + Math.min(i, 8) * 35, easing: quintOut });

  const items = $derived(app.picked);
  const minutes = $derived(items.reduce((sum, m) => sum + (m.runtime ?? 0), 0));
  let confirming = $state(false);
  let manual = $state(false); // clipboard blocked: show the text to select by hand

  const close = () => {
    app.trayOpen = false;
    confirming = false;
    manual = false;
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(app.listText());
      manual = false;
      app.notify(app.t('tray.copied'));
    } catch {
      manual = true;
      app.notify(app.t('tray.copyFailed'));
    }
  }
</script>

{#if app.trayOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="back"
    onclick={(e) => e.target === e.currentTarget && close()}
    in:fade={{ duration: 260 }}
    out:fade={{ duration: 220, delay: 40 }}
  >
    <div
      class="panel"
      role="dialog"
      aria-modal="true"
      aria-label={app.t('tray.title')}
      in:panelIn
      out:panelOut
    >
      <header>
        <h2><Ticket size={18} />{app.t('tray.title')}</h2>
        <button class="x" onclick={close} aria-label={app.t('tray.close')}><X size={22} /></button>
      </header>

      {#if items.length}
        <div class="stats">
          <div>
            <b>{items.length}</b>
            <span>{app.t('tray.films')}</span>
          </div>
          {#if minutes}
            <div>
              <b>{app.fmt.duration(minutes)}</b>
              <span>{app.t('tray.time')}</span>
            </div>
          {/if}
        </div>

        <ul>
          {#each items as m, i (m.id)}
            <li in:itemIn|global={i}>
              <div class="thumb"><Poster film={m} size="w185" /></div>
              <div class="info">
                <button class="name" onclick={() => ((app.detail = m), close())}>
                  {app.title(m)}
                </button>
                <span class="muted">
                  {[
                    m.year,
                    [...m.formats.map(app.formatName), ...(m.plex ? ['Plex'] : [])].join(', ')
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <button
                class="rm"
                onclick={() => app.toggle(m)}
                aria-label="{app.t('tray.remove')}: {app.title(m)}"
                title={app.t('tray.remove')}
              >
                <X size={17} />
              </button>
            </li>
          {/each}
        </ul>

        {#if manual}
          <textarea
            readonly
            rows="6"
            onfocus={(e) => e.currentTarget.select()}>{app.listText()}</textarea>
        {/if}

        <div class="actions">
          <button class="primary" onclick={copy}>
            <ClipboardCopy size={17} />{app.t('tray.copy')}
          </button>
          {#if confirming}
            <button
              class="ghost danger"
              onclick={() => {
                app.clearSelection();
                confirming = false;
              }}
            >
              {app.t('tray.confirm')}
            </button>
          {:else}
            <button class="ghost" onclick={() => (confirming = true)}>
              <Trash size={16} />{app.t('tray.clear')}
            </button>
          {/if}
        </div>
      {:else}
        <figure class="empty">
          <blockquote>{app.t('tray.empty')}</blockquote>
          <figcaption>
            {app.t('tray.emptyBy')}
            <span class="film">
              <cite>{app.t('tray.emptyFilm')}</cite>
              (1988)
            </span>
          </figcaption>
        </figure>
      {/if}
    </div>
  </div>
{/if}

<style>
  .back {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: #04061a99;
    backdrop-filter: blur(3px);
    display: flex;
    justify-content: flex-end;
  }
  .panel {
    width: min(420px, 100%);
    height: 100%;
    overflow-y: auto;
    background: linear-gradient(180deg, var(--card), var(--bg2));
    border-left: 1px solid #3b4a8f;
    padding: 18px 18px 24px;
    box-shadow: -18px 0 48px #0009;
  }
  .empty {
    margin: 48px 8px;
    text-align: center;
  }
  blockquote {
    margin: 0 0 10px;
    font: italic 600 24px/1.25 var(--serif);
    color: var(--text);
  }
  figcaption {
    font-size: 13px;
    color: var(--muted);
    text-wrap: balance;
  }
  .film {
    display: block;
  }
  cite {
    font-style: italic;
    margin-right: 0.15em; /* the italic "?" leans into the year */
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 700 13px/1 var(--title);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .x {
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
  .stats {
    display: flex;
    gap: 28px;
    margin-bottom: 14px;
  }
  .stats div {
    display: flex;
    flex-direction: column;
  }
  .stats b {
    font: 700 28px/1.1 var(--serif);
    color: var(--gold);
  }
  .stats span {
    font-size: 12px;
    color: var(--muted);
  }
  ul {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  li {
    display: grid;
    grid-template-columns: 46px 1fr auto;
    gap: 12px;
    align-items: center;
  }
  .thumb {
    width: 46px;
  }
  .info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    font: 600 14px/1.25 var(--title);
    color: var(--text);
  }
  .name:hover {
    color: var(--gold);
  }
  .muted {
    font-size: 12px;
  }
  .rm {
    background: none;
    border: 0;
    color: var(--muted);
    display: grid;
    place-items: center;
    padding: 6px;
  }
  .rm:hover {
    color: var(--text);
  }
  textarea {
    width: 100%;
    margin-bottom: 14px;
    background: #0a1030;
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px;
    font: 13px/1.4 var(--sans);
    resize: vertical;
  }
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .primary,
  .ghost {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border-radius: 999px;
    padding: 8px 16px;
    font-weight: 700;
    font-size: 13.5px;
  }
  .primary {
    background: var(--red);
    border: 1px solid var(--red);
    color: #fff;
  }
  .primary:hover {
    background: var(--red-hi);
  }
  .ghost {
    background: #0a1030;
    border: 1px solid var(--line);
    color: var(--muted);
  }
  .ghost:hover {
    color: var(--text);
  }
  .ghost.danger {
    color: #ff9a9a;
    border-color: #7a2a2a;
  }
</style>
