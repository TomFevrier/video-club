// Pure helpers for sync.mjs (no I/O, so they can be unit tested): the rules that turn the sheet's rows into one entry
// per film. Only the columns used here ever reach the site: prices, order numbers, who bought what and the personal
// ratings stay in the sheet.
import { csvParse } from 'd3-dsv';

/** CSV -> array of objects (d3-dsv), with trimmed headers/values and BOM stripped. */
export function parseCsv(text) {
  return csvParse(text.replace(/^\uFEFF/, ''))
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), (v ?? '').trim()])))
    .filter((r) => Object.values(r).some(Boolean));
}

/** "4,5" -> 4.5, "" -> null */
export function parseNumber(s) {
  const n = parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const FORMAT_ORDER = ['4K', 'BR', '3D', 'DVD'];

/**
 * Formats of a copy, from its `def` ("HD", "4K", "DVD", "3D") and `combo` ("4K + BR + bonus", "BR 3D + DVD") cells:
 * split on "+", "HD" counts as Blu-ray ("BR"), anything that is not a disc (bonus, booklet, CD…) is ignored.
 */
export function parseFormats(...cells) {
  const found = new Set();
  for (const cell of cells)
    for (const token of (cell ?? '').split('+')) {
      const t = token.trim();
      if (/3D/i.test(t)) found.add('3D');
      else if (/^(HD|BR)\b/i.test(t)) found.add('BR');
      else if (/^4K\b/i.test(t)) found.add('4K');
      else if (/^DVD\b/i.test(t)) found.add('DVD');
    }
  return FORMAT_ORDER.filter((f) => found.has(f));
}

/** Subtitles: "Oui", "SM" (on the disc's menu) and "Partiel" count; "Non" and blank do not. */
export const hasSubtitles = (v) => /^(oui|sm|partiel)/i.test((v ?? '').trim());

const LANGUAGES = { cn: 'zh', jp: 'ja', gr: 'el', cz: 'cs', se: 'sv', dk: 'da' };
/** "EN" -> "en", "CN" / "ZH/CN" -> "zh", "JP" -> "ja" (ISO 639-1); null when unknown. */
export function parseLanguage(s) {
  const first = (s ?? '')
    .trim()
    .toLowerCase()
    .split(/[\s/,]+/)[0];
  return first ? (LANGUAGES[first] ?? first) : null;
}

/** "Dolby Vision", "HDR10" (or null) */
export function parseHdr(s) {
  if (/dolby/i.test(s ?? '')) return 'Dolby Vision';
  if (/hdr10/i.test(s ?? '')) return 'HDR10';
  return null;
}

/** Distributor of a copy ("editeur"), without the one handling it for them: "StudioCanal (distribué par Universal…)" -> "StudioCanal". */
export const parseDistributor = (s) =>
  (s ?? '').replace(/\s*\(distribu[ée].*$/i, '').trim() || null;

/** Lending rule of a copy: INTERDIT = can't be lent; anything else (Oui, Maybe, blank) can. */
export const lendable = (v) => !/^interdit/i.test((v ?? '').trim());

/**
 * The sheet files titles library-style, with the leading words at the end in brackets: "Haine (La)",
 * "Truman Show (The)", "Amélie Poulain (Le Fabuleux Destin d’)", "Pinocchio (Guillermo del Toro’s)". Put them back in
 * front. Other brackets are part of the title ("JSA (Joint Security Area)", "Frontière(s)") or a translation
 * ("Rear Window (Fenêtre sur cour)"): an inversion is a lone article, or words ending in "de", "of", "’s"….
 */
const ARTICLE = String.raw`(?:the|an?|les?|la|l[’']|une?|des)`;
const INVERTED = new RegExp(
  String.raw`^(.+?)\s+\((${ARTICLE}|.*(?:\s(?:de|du|des|of)|\sd[’']|[’']s))\)$`,
  'i'
);
export function readableTitle(title) {
  const m = title.trim().match(INVERTED);
  if (!m) return title.trim();
  const [, rest, front] = m;
  return /[’']$/.test(front) ? front + rest : `${front} ${rest}`;
}

/** "fave" (4.5 and up) | "recommended" (4 and up) | null, from a rating out of 5. */
export function tierFromRating(rating, { faveMin = 4.5, recommendedMin = 4 } = {}) {
  if (rating == null) return null;
  if (rating >= faveMin) return 'fave';
  if (rating >= recommendedMin) return 'recommended';
  return null;
}
const TIER_RANK = { recommended: 1, fave: 2 };
const bestTier = (a, b) => ((TIER_RANK[a] ?? 0) >= (TIER_RANK[b] ?? 0) ? a : b) ?? null;

/**
 * One entry per film (TMDb id) from the sheet's rows. Left out, and counted in `skipped`:
 *   - copies whose "❓" cell holds a marker from config.skipMarkers (⏳ not received yet, ❌ to sell, 🫥 never received)
 *   - rows without a numeric TMDb id: box sets ("Coffret"), documentaries TMDb doesn't list, spacer rows
 * Several copies / editions of a film are merged: formats are the union, availability the most open one.
 * `picks` = the manual lists of TMDb ids ({ recommended: [...], faves: [...] }) for films without a rating.
 */
export function groupFilms(rows, { config, picks = {} }) {
  const skipped = { excluded: 0, boxes: 0, unlendable: 0, unmatched: [] };
  const byId = new Map();
  const manual = new Map([
    ...(picks.recommended ?? []).map((id) => [+id, 'recommended']),
    ...(picks.faves ?? []).map((id) => [+id, 'fave'])
  ]);

  for (const r of rows) {
    const title = (r.titre ?? '').trim();
    const rawId = (r.tmdb_id ?? '').trim();
    if (!title || title === '0') continue; // spacer row
    if ((config.skipMarkers ?? []).some((m) => (r['❓'] ?? '').includes(m))) {
      skipped.excluded++;
      continue;
    }
    if (!/^\d+$/.test(rawId)) {
      if (/^coffret$/i.test(rawId) || /^0\s*\//.test(title))
        skipped.boxes++; // box sets are named "0 / …"
      else skipped.unmatched.push(title);
      continue;
    }
    const id = +rawId;
    const formats = parseFormats(r.def, r.combo);
    let f = byId.get(id);
    if (!f) {
      f = {
        id,
        tmdbId: id,
        boxdId: null,
        title: readableTitle(title),
        year: parseNumber(r.annee),
        formats: [],
        hdr: null,
        language: null,
        subtitles: { fr: false, en: false },
        plex: false,
        distributors: [],
        lendable: false,
        rating: null,
        tier: null
      };
      byId.set(id, f);
    }
    f.boxdId ??= /^[A-Za-z0-9]{3,6}$/.test(r.boxd_id ?? '') ? r.boxd_id : null;
    f.year ??= parseNumber(r.annee);
    f.formats = FORMAT_ORDER.filter((x) => f.formats.includes(x) || formats.includes(x));
    f.hdr ??= parseHdr(r.hdr);
    f.language ??= parseLanguage(r.lang_originale);
    f.subtitles.fr ||= hasSubtitles(r.sub_fr);
    f.subtitles.en ||= hasSubtitles(r.sub_en);
    f.plex ||= (r['💾'] ?? '').includes('✅'); // 💾 alone = still to rip
    const distributor = parseDistributor(r.editeur);
    if (distributor && !f.distributors.includes(distributor)) f.distributors.push(distributor);
    f.lendable ||= lendable(r.accord_prealable_paul); // one lendable copy is enough
    const note = parseNumber(r['note T']);
    if (note != null) f.rating = Math.max(f.rating ?? 0, note);
  }

  // a film none of whose copies can be lent isn't shown at all
  const films = [...byId.values()].filter((f) => f.lendable);
  skipped.unlendable = byId.size - films.length;
  for (const f of films) {
    delete f.lendable;
    f.tier = bestTier(tierFromRating(f.rating, config.picks), manual.get(f.id) ?? null);
    delete f.rating; // a personal rating: only the tier is published
  }
  return { films, skipped };
}

/**
 * Poster of a film for a page language (`lang`, "en" or "fr"). Same rule in cine-stats and video-club:
 *   English page: an English-language poster whenever TMDb has one, then the original language, then French.
 *   French page:  policy "original": English and French films keep their original poster, the others get the French
 *                 one (then English, then the original language). Policy "always-original": the original language first.
 * Within a language the best-rated poster wins; TMDb's default poster is the last resort, so there is always one.
 */
export function pickPoster(images, originalLanguage, lang, defaultPath, policy = 'original') {
  const list = [...(images?.posters ?? [])].sort(
    (a, b) =>
      (b.vote_average ?? 0) - (a.vote_average ?? 0) || (b.vote_count ?? 0) - (a.vote_count ?? 0)
  );
  const by = (l) => list.find((p) => p.iso_639_1 === l)?.file_path;
  const orig = originalLanguage || 'en';
  const wanted =
    lang === 'en'
      ? ['en', orig, 'fr']
      : policy === 'always-original' || orig === 'en' || orig === 'fr'
        ? [orig, 'fr', 'en']
        : ['fr', 'en', orig];
  for (const l of wanted) {
    const p = by(l);
    if (p) return p;
  }
  return defaultPath || list[0]?.file_path || null;
}

/** TMDb uses "cn" for Cantonese, which isn't an ISO code: "yue" is, and Intl knows it ("Cantonese"). */
export const normaliseLanguage = (code) => (code === 'cn' ? 'yue' : code || null);

/**
 * Display name of a TMDb collection: without the "Collection" / "Saga" that TMDb adds around it.
 *   "John Wick Collection" -> "John Wick", "Mission : Impossible - Saga" -> "Mission : Impossible",
 *   "Collection Alien" -> "Alien". Anything else (such as "Trilogie") is part of the name and stays. TMDb's trailing
 * qualifiers go too ("Troll (1986)", "Detective Dee Collection (Tsui Hark)"): within one catalogue they aren't needed.
 */
export function cleanCollectionName(name) {
  const affix = (s) =>
    s
      .replace(/^(la\s+)?(collection|saga)\s*(:|-|–)?\s+/i, '')
      .replace(/\s*(:|-|–)?\s*(\(|\[)?(la\s+)?(collection|saga)(\)|\])?$/i, '');
  // "Doctor Who (Peter Cushing) Collection": the qualifier only ends the name once "Collection" is gone
  return affix(affix(String(name ?? '')).replace(/\s*\([^)]*\)\s*$/, ''))
    .replace(/\.\.\./g, '…')
    .trim();
}

/**
 * Sagas for the filter. A saga is a TMDb collection, or one of `manual.sagas` (series TMDb doesn't group, such as
 * Park Chan-wook's Vengeance trilogy), with at least `min` films in the catalogue. A film in a manual saga leaves its
 * TMDb one. `manual.names` renames TMDb collections ({ id: { en, fr } }), `manual.exclude` drops some (ids).
 *
 *   films       [{ id, collection: { id, name } | null }]
 *   collections { id: { en, fr } }: translated TMDb collection names (raw, cleaned here)
 * Returns { sagas: [{ id, name: { en, fr }, count }], sagaOf: Map(filmId -> sagaId) }.
 */
export function buildSagas(films, collections = {}, manual = {}, { min = 2 } = {}) {
  const sagaOf = new Map();
  const names = new Map();
  const exclude = new Set((manual.exclude ?? []).map(String));
  for (const f of films) {
    const c = f.collection;
    if (!c || exclude.has(String(c.id))) continue;
    const id = `c${c.id}`;
    sagaOf.set(f.id, id);
    if (!names.has(id)) {
      const t = collections[c.id] ?? {};
      const en = cleanCollectionName(t.en || c.name);
      const custom = manual.names?.[c.id] ?? {};
      names.set(id, {
        en: custom.en ?? en,
        fr: custom.fr ?? (cleanCollectionName(t.fr) || en)
      });
    }
  }
  for (const s of manual.sagas ?? []) {
    const id = `m-${slug(s.name.en)}`;
    names.set(id, { en: s.name.en, fr: s.name.fr ?? s.name.en });
    for (const filmId of s.films) sagaOf.set(+filmId, id);
  }
  const counts = new Map();
  for (const id of sagaOf.values()) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [filmId, id] of sagaOf) if (counts.get(id) < min) sagaOf.delete(filmId);
  const sagas = [...names]
    .filter(([id]) => counts.get(id) >= min)
    .map(([id, name]) => ({ id, name, count: counts.get(id) }))
    .sort((a, b) => a.name.en.localeCompare(b.name.en, 'en', { sensitivity: 'base' }));
  return { sagas, sagaOf };
}
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Round flags of languages, as standalone SVG strings, from the Iconify "circle-flags" set: `lang-xx` icons (following
 * aliases, such as lang-fr -> fx), or a country flag from `fallback` ({ yue: 'hk' }) for languages the set lacks.
 * Languages with neither are left out (the site then shows the name alone).
 */
export function languageFlags(iconset, codes, fallback = {}) {
  const resolve = (name) => {
    for (let i = 0; name && i < 5; i++) {
      if (iconset.icons[name]) return iconset.icons[name];
      name = iconset.aliases?.[name]?.parent;
    }
    return null;
  };
  const out = {};
  for (const code of codes) {
    const icon = resolve(`lang-${code}`) ?? (fallback[code] ? resolve(fallback[code]) : null);
    if (!icon) continue;
    const w = icon.width ?? iconset.width ?? 16;
    const h = icon.height ?? iconset.height ?? 16;
    out[code] =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.left ?? 0} ${icon.top ?? 0} ${w} ${h}">${icon.body}</svg>`;
  }
  return out;
}
