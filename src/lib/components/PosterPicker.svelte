<script>
  // Dev server only (pnpm dev): choose another TMDb poster for the open film. The choice goes to data/posters.json,
  // which the build applies. Not shown, and not bundled with the data, on the built site.
  import X from '@lucide/svelte/icons/x';
  import ImageIcon from '@lucide/svelte/icons/image';
  import { app } from '$lib/state.svelte.js';

  let { film } = $props();
  let open = $state(false);
  let choices = $state(null);
  let error = $state('');

  const info = $derived(choices?.[film.id]);
  const current = $derived(app.poster(film));

  async function show() {
    open = true;
    // every poster of every film, written by the sync: loaded when first needed
    choices ??= (await import('$lib/data/poster-choices.json')).default;
  }
  async function pick(path) {
    error = '';
    try {
      await app.pickPoster(film, path, info.default[app.lang]);
    } catch (e) {
      error = e.message;
    }
  }
  const label = (p) => (p.lang ? p.lang.toUpperCase() : 'no text');
</script>

<button class="change" onclick={show} title="Choose another poster (dev only)">
  <ImageIcon size={14} />Change poster
</button>

{#if open}
  <div class="panel" role="dialog" aria-label="Choose a poster">
    <div class="bar">
      <b>Poster for the {app.lang.toUpperCase()} page</b>
      <button class="reset" onclick={() => pick(null)}>Default</button>
      <button class="close" onclick={() => (open = false)} aria-label="Close">
        <X size={20} />
      </button>
    </div>
    {#if error}<p class="err">{error}</p>{/if}
    {#if info}
      <div class="grid">
        {#each info.list as p (p.path)}
          <button class="opt" class:on={p.path === current} onclick={() => pick(p.path)}>
            <img src="https://image.tmdb.org/t/p/w185{p.path}" alt="" loading="lazy" />
            <span>{label(p)}</span>
          </button>
        {/each}
      </div>
    {:else if choices}
      <p class="err">No poster list for this film: run the sync with a TMDB_API_KEY.</p>
    {:else}
      <p class="err">Loading…</p>
    {/if}
  </div>
{/if}

<style>
  .change {
    margin-top: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    background: #070b1ccc;
    border: 1px dashed #ffffff40;
    border-radius: 999px;
    padding: 4px 10px;
  }
  .change:hover {
    color: var(--text);
    border-color: #ffffff80;
  }
  .panel {
    position: absolute;
    inset: 0;
    z-index: 5;
    overflow: auto;
    padding: 16px;
    border-radius: 16px;
    background: var(--card);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    font-size: 14px;
  }
  .bar b {
    flex: 1;
  }
  .reset {
    font-size: 12px;
    color: var(--text);
    background: var(--card2);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 3px 12px;
  }
  .close {
    background: none;
    border: 0;
    color: var(--muted);
    display: grid;
    padding: 2px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
  }
  .opt {
    display: grid;
    gap: 4px;
    justify-items: center;
    padding: 0;
    background: none;
    border: 0;
    font-size: 11px;
    color: var(--muted);
  }
  .opt img {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border-radius: 6px;
    outline: 2px solid transparent;
    outline-offset: 2px;
  }
  .opt:hover img {
    outline-color: #ffffff80;
  }
  .opt.on img {
    outline-color: var(--gold);
  }
  .err {
    font-size: 13px;
    color: var(--muted);
  }
</style>
