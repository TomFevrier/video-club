#!/usr/bin/env node
// Draws the social preview image (1200x630 layout, rendered at 2400x1260), one per language, at build time:
//   static/og/og-<lang>-<hash>.jpg   (the hash changes with the content, so social networks fetch the new one)
//   src/lib/data/og.json             (file names and alt texts, read by Catalogue.svelte for the <meta> tags)
//
// A bookcase of three shelves beside the title. The cases facing out are the films listed in config.json → og.faces
// (posters in the card's language); the spines between them are other faves and recommended films. Blue for Blu-ray,
// black for 4K, as on the real cases.
//
//   node scripts/og.mjs                    the build's card
//   node scripts/og.mjs --preview <dir>    both languages into <dir> (og.json and static/og are left alone)
//
// It never fails the build: if anything goes wrong it logs why, and the pages get no og:image.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const log = (...a) => console.log('[og]', ...a);
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const DATA = path.join(root, 'src/lib/data/movies.json');
const OUT_JSON = path.join(root, 'src/lib/data/og.json');
const OUT_DIR = path.join(root, 'static/og');
const CACHE = path.join(root, '.cache/og');
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const LANGS = ['en', 'fr'];
const W = 1200;
const H = 630;
// drawn at twice the size (2400x1260), so the small posters stay sharp on high-density screens
const SCALE = 2;
const GOLD = '#eab62f';
const MUTED = '#9aa5d3';

const TEXT = {
  en: {
    kicker: 'BLU-RAY · 4K · DVD',
    // the name on two lines, broken where it reads best (not at the hyphen of "vidéo-club"); ◎ = the disc, as on the
    // favicon, in place of the o of "video"
    title: ['Tom’s', 'Vide◎ Club'],
    films: (n) => `${n} films to borrow`,
    alt: (titles) => `Blu-ray cases of some of Tom’s favourite films on shelves: ${titles}`
  },
  fr: {
    kicker: 'BLU-RAY · 4K · DVD',
    title: ['Le vidé◎-club', 'de Tom'],
    films: (n) => `${n} films à emprunter`,
    alt: (titles) => `Boîtiers Blu-ray de films préférés de Tom sur des étagères : ${titles}`
  }
};

// The bookcase: three shelves of five cases facing out (C), with spines in between (+ = as many as fit; the spines
// are shared out between the +s of a row). L = a spine leaning on its left neighbour, at the end of a row.
const ROWS = ['C+CC+C+C', '+C+CC+C+C+L', 'CC+C+C+C'];
const CASE_W = 88;
const POSTER_H = Math.round(CASE_W * 1.5);
const BAND_H = 9;
const CASE_H = POSTER_H + BAND_H; // spines are the same height
const SPINE_W = 22;
const SHELF_W = 690;
const SHELF_PAD = 16;
const GAP_FACE = 8; // around a case facing out
const GAP_SPINE = 1; // between two spines
const LEAN = 9; // degrees
const SPINE_FONT = 11;
const SPINE_TEXT = CASE_H - BAND_H - 12; // room for the title along the spine

/** Where the page lives, for absolute URLs. Branch deploys and deploy previews: their own address (SITE_URL wins). */
function siteUrl() {
  const own =
    process.env.CONTEXT && process.env.CONTEXT !== 'production'
      ? process.env.DEPLOY_PRIME_URL
      : null;
  const url = process.env.SITE_URL ?? (own ? `${own}/` : config.siteUrl);
  return !url || url.endsWith('/') ? url : `${url}/`;
}

// ---- films and posters ----------------------------------------------------------------------------------------

/** A stable shuffle: the same films stay on the card from one build to the next, new ones slot in. */
const stable = (films, salt) =>
  films
    .map((f) => [crypto.createHash('sha1').update(`${salt}${f.id}`).digest('hex'), f])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, f]) => f);

/** A poster as a data: URI (cached on disk), or null when it can't be fetched. */
async function poster(file) {
  const cached = path.join(CACHE, file.replace(/[^\w.-]/g, '_'));
  try {
    if (!fs.existsSync(cached)) {
      const res = await fetch(IMAGE_BASE + file, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
    }
    const bytes = fs.readFileSync(cached);
    const type = bytes[0] === 0x89 ? 'image/png' : 'image/jpeg';
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch (e) {
    log(`poster ${file} unavailable (${e.message}), using a placeholder`);
    return null;
  }
}

const titleOf = (f, lang) => (f.titles[lang] ?? f.titles.en).replace(/'/g, '’');
const is4K = (f) => f.formats.includes('4K');
const onDisc = (f) => is4K(f) || f.formats.includes('BR') || f.formats.includes('3D');

/**
 * Roughly how wide a spine title is, in px (Assistant Bold, capitals). Satori can't shorten text it rotates, so only
 * films whose title fits along the spine, in both languages, are put on one.
 */
function spineTextWidth(text) {
  let em = 0;
  for (const c of text.toUpperCase())
    em += /[\s.,:;'’!|-]/.test(c) ? 0.26 : /[IJ1]/.test(c) ? 0.3 : /[MWŒÆ]/.test(c) ? 0.82 : 0.6;
  return em * SPINE_FONT + text.length * 0.4; // + letter spacing
}

// ---- building blocks ------------------------------------------------------------------------------------------

const h = (type, style, ...children) => ({
  type,
  props: {
    style: { display: 'flex', ...style },
    children: children.flat().filter((c) => c != null)
  }
});

const BLUE = '#1d5fd1';
const BLACK = '#111114';
const colourOf = (f) => (is4K(f) ? BLACK : BLUE);

/** A case seen from the front: the format band, the poster, a plastic sheen and the darker hinge. */
function caseFront(film) {
  return h(
    'div',
    {
      position: 'relative',
      flexDirection: 'column',
      width: CASE_W,
      height: CASE_H,
      borderRadius: 3,
      overflow: 'hidden',
      background: colourOf(film),
      boxShadow: '0 10px 22px rgba(0,0,0,0.55)',
      flexShrink: 0
    },
    h('div', { height: BAND_H }),
    film.image
      ? {
          type: 'img',
          props: {
            src: film.image,
            width: CASE_W,
            height: POSTER_H,
            style: { width: CASE_W, height: POSTER_H, objectFit: 'cover' }
          }
        }
      : h(
          'div',
          {
            width: CASE_W,
            height: POSTER_H,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            textAlign: 'center',
            background: 'linear-gradient(160deg, #7a1f27, #1a2352)',
            color: '#f3e7c3',
            fontFamily: 'Playfair Display',
            fontWeight: 700,
            fontSize: 13
          },
          film.title
        ),
    h('div', {
      position: 'absolute',
      left: 0,
      top: 0,
      width: CASE_W,
      height: CASE_H,
      background:
        'linear-gradient(115deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.04) 32%, rgba(255,255,255,0) 50%)'
    }),
    h('div', {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 4,
      height: CASE_H,
      background: 'linear-gradient(90deg, rgba(0,0,0,0.45), rgba(0,0,0,0.1))'
    })
  );
}

/** A case seen from the side: the spine, a lighter cap and the title running up it. */
function spine(film, extra = {}) {
  return h(
    'div',
    {
      position: 'relative',
      flexDirection: 'column',
      width: SPINE_W,
      height: CASE_H,
      flexShrink: 0,
      borderRadius: 2,
      background: `linear-gradient(90deg, rgba(0,0,0,0.35), rgba(255,255,255,0.09) 45%, rgba(0,0,0,0.3)), ${colourOf(film)}`,
      boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
      ...extra
    },
    h('div', { height: BAND_H, background: 'rgba(255,255,255,0.12)' }),
    // the title, turned a quarter: a box as long as the spine, rotated about its centre
    h(
      'div',
      {
        position: 'absolute',
        width: SPINE_TEXT,
        height: SPINE_W,
        left: (SPINE_W - SPINE_TEXT) / 2,
        top: BAND_H + 6 + (SPINE_TEXT - SPINE_W) / 2,
        transform: 'rotate(-90deg)',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Assistant',
        fontWeight: 700,
        fontSize: SPINE_FONT,
        letterSpacing: 0.4,
        whiteSpace: 'nowrap',
        color: 'rgba(255,255,255,0.9)'
      },
      film.title.toUpperCase()
    )
  );
}

/** The plank the cases stand on: a lit top edge, the front face and a shadow underneath. */
const plank = () =>
  h(
    'div',
    { flexDirection: 'column', width: SHELF_W, flexShrink: 0 },
    h('div', { height: 5, background: '#4a5fb8', borderRadius: '3px 3px 0 0' }),
    h('div', {
      height: 13,
      background: 'linear-gradient(180deg, #26357a, #131d44)',
      boxShadow: '0 14px 26px rgba(0,0,0,0.55)'
    })
  );

/**
 * A rotation about the bottom-left corner. Satori ignores transform-origin and turns elements about their centre, so
 * this moves the box back by however far the corner travelled.
 */
function pivot(deg, w, hgt) {
  const a = (deg * Math.PI) / 180;
  const [x, y] = [-w / 2, hgt / 2]; // the corner, from the centre
  const dx = x * Math.cos(a) - y * Math.sin(a) - x;
  const dy = x * Math.sin(a) + y * Math.cos(a) - y;
  return `translate(${(-dx).toFixed(1)}px, ${(-dy).toFixed(1)}px) rotate(${deg}deg)`;
}

/** How far the leaning spine's top moves left: the gap left before it, so it rests on its neighbour. */
const leanGap = Math.round(CASE_H * Math.sin((LEAN * Math.PI) / 180));

// the leaning spine first: next to a case facing out it still needs room for its tilt
const gapBetween = (a, b) => (b === 'L' ? leanGap : a === 'C' || b === 'C' ? GAP_FACE : GAP_SPINE);

/** A row's kinds of item (C, S, L) once its +s are filled with spines, as many as the shelf holds. */
function layoutRow(pattern) {
  const slots = [...pattern].filter((p) => p === '+').length;
  const expand = (k) => {
    const sizes = Array.from({ length: slots }, (_, i) => Math.floor(k / slots) + (i < k % slots));
    let slot = 0;
    return [...pattern].flatMap((p) => (p === '+' ? Array(sizes[slot++]).fill('S') : [p]));
  };
  const width = (kinds) =>
    kinds.reduce(
      (sum, k, i) => sum + (k === 'C' ? CASE_W : SPINE_W) + (i ? gapBetween(kinds[i - 1], k) : 0),
      0
    );
  let k = 0;
  while (width(expand(k + 1)) <= SHELF_W - 2 * SHELF_PAD) k++;
  return expand(k);
}

function shelf(pattern, faces, spines) {
  const kinds = layoutRow(pattern);
  const items = kinds.map((k) => {
    if (k === 'C') return caseFront(faces.next());
    if (k === 'L') return spine(spines.next(), { transform: pivot(-LEAN, SPINE_W, CASE_H) });
    return spine(spines.next());
  });
  return h(
    'div',
    { flexDirection: 'column', width: SHELF_W },
    h(
      'div',
      { alignItems: 'flex-end', height: CASE_H, paddingLeft: SHELF_PAD, paddingRight: SHELF_PAD },
      items.map((it, i) =>
        i ? [h('div', { width: gapBetween(kinds[i - 1], kinds[i]), flexShrink: 0 }), it] : it
      )
    ),
    plank()
  );
}

const queue = (list) => {
  let i = 0;
  return { next: () => list[i++ % list.length] };
};

/** The disc of the favicon (static/favicon.svg) in place of the o of "video": as wide as an o, on the baseline. */
const DISC = `data:image/svg+xml;base64,${fs.readFileSync(path.join(root, 'static/favicon.svg')).toString('base64')}`;
const disc = (fontSize) => {
  const size = Math.round(fontSize * 0.58);
  return {
    type: 'img',
    props: {
      src: DISC,
      width: size,
      height: size,
      // nudged below the baseline like a round letter (satori ignores a negative margin here)
      style: {
        margin: `0 ${fontSize * 0.02}px`,
        position: 'relative',
        top: Math.round(fontSize * 0.04)
      }
    }
  };
};

/** The title block: kicker, name, number of films, address. The name's size fits its longest line in the column. */
function heading({ lang, counts, host }) {
  const T = TEXT[lang];
  const n = (x) => x.toLocaleString(lang);
  const titleSize = Math.min(
    72,
    Math.floor(390 / (0.53 * Math.max(...T.title.map((l) => l.length))))
  );
  return h(
    'div',
    { flexDirection: 'column', width: 400 },
    h(
      'div',
      { fontFamily: 'Assistant', fontWeight: 800, fontSize: 22, letterSpacing: 5, color: GOLD },
      T.kicker
    ),
    h(
      'div',
      {
        fontFamily: 'Assistant',
        fontWeight: 800,
        fontSize: titleSize,
        lineHeight: 1.02,
        flexDirection: 'column',
        color: '#ffffff',
        marginTop: 10
      },
      T.title.map((line) =>
        h(
          'div',
          { alignItems: 'baseline' },
          line
            .split(/(◎)/)
            .map((part) => (part === '◎' ? disc(titleSize) : h('div', { whiteSpace: 'pre' }, part)))
        )
      )
    ),
    h(
      'div',
      { fontFamily: 'Lato', fontSize: 26, color: MUTED, marginTop: 20 },
      T.films(n(counts.films))
    ),
    h('div', { fontFamily: 'Lato', fontSize: 22, color: '#6f7ab0', marginTop: 34 }, host)
  );
}

function card({ faces, spines, lang, counts, host }) {
  const f = queue(faces);
  const s = queue(spines);
  const height = ROWS.length * (CASE_H + 18) + (ROWS.length - 1) * 24;
  return h(
    'div',
    {
      position: 'relative',
      width: W,
      height: H,
      background: 'linear-gradient(125deg, #0a0f24 0%, #0e1633 55%, #1b1240 100%)',
      overflow: 'hidden'
    },
    h('div', {
      position: 'absolute',
      left: 0,
      top: 0,
      width: W,
      height: H,
      background:
        'radial-gradient(circle at 8% -8%, rgba(120,24,80,0.55), rgba(120,24,80,0) 48%), radial-gradient(circle at 100% 0%, rgba(20,42,102,0.9), rgba(20,42,102,0) 52%)'
    }),
    h(
      'div',
      { position: 'absolute', left: 62, top: 0, height: H, alignItems: 'center' },
      heading({ lang, counts, host })
    ),
    h(
      'div',
      {
        position: 'absolute',
        right: 30,
        top: Math.round((H - height) / 2),
        flexDirection: 'column',
        gap: 24
      },
      ROWS.map((row) => shelf(row, f, s))
    )
  );
}

// ---- main -----------------------------------------------------------------------------------------------------

function fonts() {
  const file = (pkg, name) => fs.readFileSync(require.resolve(`@fontsource/${pkg}/files/${name}`));
  return [
    ['Lato', 'lato', 'lato-latin-400-normal.woff', 400],
    ['Assistant', 'assistant', 'assistant-latin-700-normal.woff', 700],
    ['Assistant', 'assistant', 'assistant-latin-800-normal.woff', 800],
    ['Playfair Display', 'playfair-display', 'playfair-display-latin-700-normal.woff', 700]
  ].map(([name, pkg, f, weight]) => ({ name, data: file(pkg, f), weight, style: 'normal' }));
}

/** The films on the card: the fronts from config.json (in order), and spines that fit their titles. */
function choose(films) {
  const byId = new Map(films.map((f) => [f.id, f]));
  const fronts = (config.og?.faces ?? [])
    .map((id) => byId.get(id))
    .filter((f) => {
      if (!f) return false;
      if (!onDisc(f) || !(f.posters.en || f.posters.fr))
        log(`${f.titles.en}: no Blu-ray or no poster, left off the card`);
      return onDisc(f) && (f.posters.en || f.posters.fr);
    });
  const missing = (config.og?.faces ?? []).filter((id) => !byId.has(id));
  if (missing.length) log(`og.faces not in the collection: ${missing.join(', ')}`);
  // too few listed: other faves fill in
  const shown = new Set(fronts.map((f) => f.id));
  const need = ROWS.join('').split('C').length - 1;
  for (const f of stable(films, 'og'))
    if (fronts.length < need && f.tier === 'fave' && onDisc(f) && f.posters.en && !shown.has(f.id))
      (fronts.push(f), shown.add(f.id));

  const spines = stable(
    films.filter(
      (f) =>
        f.tier &&
        onDisc(f) &&
        !shown.has(f.id) &&
        LANGS.every((l) => spineTextWidth(titleOf(f, l)) <= SPINE_TEXT)
    ),
    'spine'
  );
  return { fronts: fronts.slice(0, need), spines };
}

async function render(lang, chosen, opts) {
  const { default: satori } = await import('satori');
  const { Resvg } = await import('@resvg/resvg-js');
  const faces = await Promise.all(
    chosen.fronts.map(async (f) => {
      // a cleaner poster from config.json → og.posters when the usual one is covered in text
      const file = config.og?.posters?.[f.id]?.[lang] ?? f.posters[lang] ?? f.posters.en;
      return { ...f, title: titleOf(f, lang), image: file ? await poster(file) : null };
    })
  );
  const spines = chosen.spines.map((f) => ({ ...f, title: titleOf(f, lang) }));
  const svg = await satori(card({ faces, spines, lang, ...opts }), {
    width: W,
    height: H,
    fonts: opts.fonts
  });
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: W * SCALE } }).render();
  // JPEG: a PNG of this many posters weighs over 2 MB, too much for some messaging apps' previews
  const { default: jpeg } = await import('jpeg-js');
  const image = jpeg.encode({ data: img.pixels, width: img.width, height: img.height }, 85).data;
  return { image, faces };
}

async function main() {
  const films = JSON.parse(fs.readFileSync(DATA, 'utf8')).films;
  const chosen = choose(films);
  const counts = { films: films.length };
  const site = siteUrl();
  const host = (site || 'tomfevrier.io/video-club').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const opts = { counts, host, fonts: fonts() };

  const args = process.argv.slice(2);
  const preview = args.includes('--preview') ? args[args.indexOf('--preview') + 1] : null;
  if (preview) {
    fs.mkdirSync(preview, { recursive: true });
    for (const lang of LANGS) {
      const { image } = await render(lang, chosen, opts);
      fs.writeFileSync(path.join(preview, `shelves-${lang}.jpg`), image);
      log(`wrote ${path.join(preview, `shelves-${lang}.jpg`)}`);
    }
    return;
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = { width: W * SCALE, height: H * SCALE, siteUrl: site };
  for (const lang of LANGS) {
    const { image, faces } = await render(lang, chosen, opts);
    const name = `og-${lang}-${crypto.createHash('sha1').update(image).digest('hex').slice(0, 10)}.jpg`;
    fs.writeFileSync(path.join(OUT_DIR, name), image);
    out[lang] = { file: `og/${name}`, alt: TEXT[lang].alt(faces.map((f) => f.title).join(', ')) };
    log(`${lang}: static/og/${name} (${(image.length / 1024).toFixed(0)} KB)`);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(out));
}

try {
  await main();
} catch (e) {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify({}));
  log(`could not draw the preview images (${e.stack}); the pages will have no og:image`);
}
