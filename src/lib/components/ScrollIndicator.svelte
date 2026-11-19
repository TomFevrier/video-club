<script>
  // The page's scrollbar, drawn over the content instead of beside it (app.css hides the native one): no gutter, and no
  // sideways jump when filtering makes the page short enough not to scroll. It shows while scrolling, near the right
  // edge on hover, and while dragged; it fades out a moment later. Decorative for assistive tech: the page itself still
  // scrolls with the keyboard, wheel, trackpad and touch.
  let canScroll = $state(false);
  let size = $state(0); // thumb height
  let offset = $state(0); // thumb position
  let active = $state(false); // scrolled a moment ago
  let hover = $state(false);
  let drag = $state(null); // { y, scroll } at the start of a drag
  let timer;

  const range = () => document.documentElement.scrollHeight - innerHeight;

  function measure() {
    const total = document.documentElement.scrollHeight;
    canScroll = total > innerHeight + 1;
    size = Math.max(36, (innerHeight * innerHeight) / total);
    offset = range() > 0 ? (scrollY / range()) * (innerHeight - size) : 0;
  }

  function onscroll() {
    measure();
    active = true;
    clearTimeout(timer);
    timer = setTimeout(() => (active = false), 900);
  }

  // the page's height changes with every filter: follow it
  $effect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  });

  function down(e) {
    drag = { y: e.clientY, scroll: scrollY };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault(); // no text selection while dragging
    e.stopPropagation(); // not a click on the track
  }
  // a click on the track jumps there (the thumb centred on the click), and can carry on as a drag
  function jump(e) {
    const ratio = (e.clientY - size / 2) / (innerHeight - size);
    window.scrollTo({ top: Math.min(1, Math.max(0, ratio)) * range(), behavior: 'instant' });
    measure();
    down(e);
  }
  function move(e) {
    if (!drag) return;
    const top = drag.scroll + ((e.clientY - drag.y) * range()) / (innerHeight - size);
    window.scrollTo({ top, behavior: 'instant' }); // html has smooth scrolling: not while dragging
  }
  function up() {
    drag = null;
    onscroll(); // fade out from now
  }
</script>

<svelte:window {onscroll} onresize={measure} />

{#if canScroll}
  <div
    class="track"
    class:on={active || hover || drag}
    aria-hidden="true"
    onpointerenter={() => (hover = true)}
    onpointerleave={() => (hover = false)}
    onpointerdown={jump}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions (decorative: the track is aria-hidden) -->
    <div
      class="thumb"
      class:held={drag}
      style:height="{size}px"
      style:transform="translateY({offset}px)"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    ></div>
  </div>
{/if}

<style>
  .track {
    position: fixed;
    z-index: 60; /* under the borrow list and the details, which bring their own */
    top: 0;
    right: 0;
    bottom: 0;
    width: 14px;
    opacity: 0;
    cursor: pointer;
    transition: opacity 0.4s;
  }
  .track.on {
    opacity: 1;
    transition-duration: 0.15s;
  }
  .thumb {
    position: absolute;
    top: 0;
    right: 3px;
    width: 6px;
    border-radius: 999px;
    background: #c9d1f566;
    touch-action: none;
    cursor: pointer;
    transition:
      width 0.15s,
      background 0.15s;
  }
  .track:hover .thumb,
  .thumb.held {
    width: 9px;
    background: #c9d1f5a6;
  }
  /* touch screens: an indicator only (scrolling is done by swiping the page) */
  @media (pointer: coarse) {
    .track {
      pointer-events: none;
    }
    .thumb {
      width: 4px;
      right: 2px;
    }
  }
</style>
