<script>
  import { app } from '$lib/state.svelte.js';
  let { film, size = 'w342' } = $props();
  let failed = $state(null); // the path that failed to load (switching language may bring a working one)
  const title = $derived(app.title(film));
  // the poster in the page's language (English and French films keep their original one)
  const path = $derived(app.poster(film));
  const hue = $derived([...film.titles.en].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7));
  const bg = $derived(
    `linear-gradient(160deg, hsl(${(hue % 40) + 345} 55% 28%), hsl(${220 + (hue % 30)} 50% 18%))`
  );
</script>

<div class="poster">
  {#if path && path !== failed}
    <img
      src="https://image.tmdb.org/t/p/{size}{path}"
      alt=""
      loading="lazy"
      decoding="async"
      onerror={() => (failed = path)}
    />
  {:else}
    <div class="ph" style:background={bg}><span>{title}</span></div>
  {/if}
</div>

<style>
  .poster {
    aspect-ratio: 2 / 3;
    width: 100%;
    overflow: hidden;
    background: var(--card2);
    border-radius: 8px;
    display: block;
    container-type: inline-size;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .ph {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    padding: 10%;
    text-align: center;
  }
  .ph span {
    font: 600 max(11px, 9.5cqw) / 1.25 var(--serif);
    color: #f3e7c3;
    opacity: 0.9;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 5;
    line-clamp: 5;
    -webkit-box-orient: vertical;
    word-break: break-word;
  }
  /* thumbnails: too small for a legible title */
  @container (max-width: 90px) {
    .ph span {
      display: none;
    }
  }
</style>
