<script>
  import { base } from '$app/paths';
  import { logos } from '$lib/logos.js';

  let { name, height = 20, alt = '' } = $props();
</script>

<img src="{base}/{logos[name]}" {alt} {height} />

<style>
  img {
    display: block;
    flex: none;
    width: auto;
  }
</style>
