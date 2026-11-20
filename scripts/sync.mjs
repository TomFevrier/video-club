#!/usr/bin/env node
// Builds src/lib/data/movies.json from the Google Sheet (CSV) + TMDb.
//
//   SHEET_CSV_URL  CSV link of the sheet (a sheet link or an export link, see README), or a local path
//                  – falls back to data/blu-rays.csv
//   TMDB_API_KEY   TMDb v3 key or v4 read-access token – without it (or if TMDb is unreachable) only what is already in
//                  the cache is used, and new films get the sheet's title and year alone
//
// TMDb lookups are cached in .cache/ (kept between CI runs), so only new films cost API calls.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  parseCsv,
  groupFilms,
  pickPoster,
  normaliseLanguage,
  buildSagas,
  languageFlags
} from './lib.mjs';
import { loadDotEnv, readSheet, readSheetLinks } from './sheet.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT_FILE ?? path.join(root, 'src/lib/data/movies.json');
const FLAGS_OUT = path.join(path.dirname(OUT), 'flags.json');
const CACHE_DIR = path.join(root, '.cache');
const CACHE_FILE = process.env.CACHE_FILE ?? path.join(CACHE_DIR, 'enrich.json');
const TMDB_BASE = process.env.TMDB_BASE ?? 'https://api.themoviedb.org/3'; // overridable for tests
const DAY = 864e5;
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));

loadDotEnv(root);
const { TMDB_API_KEY } = process.env;
const log = (...a) => console.log('[sync]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. TMDb ----------------------------------------------------------------------------------------------------

const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
cache.movies ??= {};
cache.collections ??= {};
const saveCache = () => {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
};
const fresh = (e, days) => e && Date.now() - e.at < days * DAY;
// v2: posters per page language, and the film's TMDb collection (for the sagas)
// v3: the film's posters (language, rating), picked from when assembling, as in film-diary
const CACHE_VERSION = 3;

let tmdbFailures = 0;
async function tmdb(pathname, params = {}) {
  const u = new URL(`${TMDB_BASE}${pathname}`);
  const headers = { accept: 'application/json' };
  if (TMDB_API_KEY.startsWith('eyJ')) headers.authorization = `Bearer ${TMDB_API_KEY}`;
  else u.searchParams.set('api_key', TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(u, { headers });
      if (res.status === 429) {
        await sleep((+res.headers.get('retry-after') || 2) * 1000);
        continue;
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`TMDb ${res.status} on ${pathname}`);
      tmdbFailures = 0;
      return await res.json();
    } catch (e) {
      if (attempt === 3) {
        tmdbFailures++;
        throw e;
      }
      await sleep(800 * (attempt + 1));
    }
  }
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

async function enrichTmdb(films) {
  const ids = films.map((f) => f.id);
  const todo = ids.filter((id) => {
    const c = cache.movies[id];
    return !(c?.v === CACHE_VERSION && fresh(c, c.missing ? 7 : 30));
  });
  log(`tmdb: ${ids.length} films, ${todo.length} to fetch`);
  let done = 0;
  await pool(todo, 4, async (id) => {
    if (tmdbFailures >= 3) return;
    try {
      const d = await tmdb(`/movie/${id}`, {
        language: 'en-US',
        append_to_response: 'images,credits,translations',
        include_image_language: 'en,fr,null'
      });
      if (!d) {
        cache.movies[id] = { v: CACHE_VERSION, at: Date.now(), missing: true };
        return;
      }
      const fr = d.translations?.translations?.find((t) => t.iso_639_1 === 'fr')?.data ?? {};
      const c = d.belongs_to_collection;
      cache.movies[id] = {
        v: CACHE_VERSION,
        at: Date.now(),
        titleEn: d.title,
        titleFr: fr.title || null,
        originalTitle: d.original_title,
        originalLanguage: d.original_language,
        year: d.release_date ? +d.release_date.slice(0, 4) : null,
        runtime: d.runtime || null,
        genres: (d.genres ?? []).map((g) => g.name),
        directors: (d.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name),
        posterPath: d.poster_path,
        posters: (d.images?.posters ?? []).slice(0, 40).map((p) => ({
          iso_639_1: p.iso_639_1,
          file_path: p.file_path,
          vote_average: p.vote_average,
          vote_count: p.vote_count
        })),
        collection: c ? { id: c.id, name: c.name } : null
      };
      if (++done % 100 === 0) saveCache();
    } catch (e) {
      log(`tmdb: movie ${id} failed (${e.message})`);
    }
  });
  if (tmdbFailures >= 3) log('tmdb: too many failures, using the cache for the rest');
  saveCache();
}

/** English and French names of the TMDb collections that hold 2 films or more of the catalogue (for the sagas). */
async function enrichCollections(films) {
  const counts = new Map();
  for (const f of films) {
    const c = cache.movies[f.id]?.collection;
    if (c) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
  }
  const todo = [...counts]
    .filter(([id, n]) => n >= 2 && !fresh(cache.collections[id], 30))
    .map(([id]) => id);
  if (todo.length) log(`tmdb: ${todo.length} collection names to fetch`);
  await pool(todo, 4, async (id) => {
    if (tmdbFailures >= 3) return;
    try {
      const d = await tmdb(`/collection/${id}/translations`);
      const all = d?.translations ?? [];
      const title = (lang, region) =>
        all.find((t) => t.iso_639_1 === lang && t.iso_3166_1 === region)?.data?.title ||
        all.find((t) => t.iso_639_1 === lang && t.data?.title)?.data?.title ||
        null;
      cache.collections[id] = { at: Date.now(), en: title('en', 'US'), fr: title('fr', 'FR') };
    } catch (e) {
      log(`tmdb: collection ${id} failed (${e.message})`);
    }
  });
  saveCache();
}

// ---- 2. put it together -----------------------------------------------------------------------------------------

/** The poster of a cached film for a page language (null when TMDb has none). */
const poster = (m, lang) =>
  m
    ? pickPoster(
        { posters: m.posters },
        m.originalLanguage,
        lang,
        m.posterPath,
        config.posters?.policy
      )
    : null;

function assemble(sheetFilms) {
  return sheetFilms
    .map((f) => {
      const m = cache.movies[f.id] && !cache.movies[f.id].missing ? cache.movies[f.id] : null;
      const titleEn = m?.titleEn ?? f.title;
      const titleFr = m?.titleFr ?? f.title; // the sheet's titles are French
      return {
        id: f.id,
        tmdbId: f.id,
        boxdId: f.boxdId,
        blurayUrl: f.blurayUrl,
        titles: { en: titleEn, fr: titleFr },
        // the sheet's own title, kept for searching when it differs from both
        alt: [titleEn, titleFr].includes(f.title) ? null : f.title,
        originalTitle: m?.originalTitle ?? null,
        year: m?.year ?? f.year,
        runtime: m?.runtime ?? null,
        directors: m?.directors ?? [],
        genres: m?.genres ?? [],
        language: normaliseLanguage(m?.originalLanguage ?? f.language),
        subtitles: f.subtitles,
        formats: f.formats,
        hdr: f.hdr,
        plex: f.plex,
        distributors: f.distributors,
        tier: f.tier,
        posters: { en: poster(m, 'en'), fr: poster(m, 'fr') }, // per page language
        collection: m?.collection ?? null
      };
    })
    .sort((a, b) => a.titles.en.localeCompare(b.titles.en, 'en', { sensitivity: 'base' }));
}

/** Countries' flags for the languages the circle-flags set has no flag for. */
const FLAG_FALLBACK = { yue: 'hk' };

function writeFlags(films) {
  const require = createRequire(import.meta.url);
  const iconset = require('@iconify-json/circle-flags/icons.json');
  const codes = [...new Set(['en', 'fr', ...films.map((f) => f.language).filter(Boolean)])];
  const flags = languageFlags(iconset, codes, FLAG_FALLBACK);
  const missing = codes.filter((c) => !flags[c]);
  if (missing.length) log('flags: none for', missing.join(', '), '(the name is shown alone)');
  fs.writeFileSync(FLAGS_OUT, JSON.stringify(flags));
}

async function main() {
  const rows = parseCsv(await readSheet(root, log));
  const pf = path.join(root, 'data/picks.json');
  const picks = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, 'utf8')) : {};
  const links = await readSheetLinks(log);
  const { films: sheetFilms, skipped } = groupFilms(rows, { config, picks, links });
  log(
    `${rows.length} rows -> ${sheetFilms.length} films (skipped: ${skipped.excluded} not in the collection, ${skipped.boxes} box sets, ${skipped.unlendable} not lendable, ${skipped.unmatched.length} without a TMDb id)`
  );
  if (skipped.unmatchedBoxes.length)
    log(
      `${skipped.unmatchedBoxes.length} box sets no film points to by name (type_ou_coffret), so no box link`
    );
  if (skipped.unmatched.length)
    log(
      '  no TMDb id:',
      skipped.unmatched.slice(0, 5).join(' · '),
      skipped.unmatched.length > 5 ? '…' : ''
    );

  if (TMDB_API_KEY) {
    await enrichTmdb(sheetFilms);
    await enrichCollections(sheetFilms);
  } else
    log(
      'tmdb: no TMDB_API_KEY, using the cache only (new films get no poster, French title or saga)'
    );

  const assembled = assemble(sheetFilms);
  const enriched = assembled.filter(
    (f) => cache.movies[f.id] && !cache.movies[f.id].missing
  ).length;
  const noPoster = assembled.filter((f) => !f.posters.en).length;
  log(`${assembled.length} films (${enriched} from TMDb, ${noPoster} without a poster)`);

  const sagaFile = path.join(root, 'data/sagas.json');
  const manual = fs.existsSync(sagaFile) ? JSON.parse(fs.readFileSync(sagaFile, 'utf8')) : {};
  const { sagas, sagaOf } = buildSagas(assembled, cache.collections, manual);
  const films = assembled.map(({ collection: _collection, ...f }) => ({
    ...f,
    saga: sagaOf.get(f.id) ?? null
  }));
  log(
    `${sagas.length} sagas:`,
    sagas.map((s) => `${s.name.en} (${s.count})`).join(' · ') || 'none'
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      enriched: !!TMDB_API_KEY,
      sagas,
      films
    })
  );
  writeFlags(films);
}

main().catch((e) => {
  console.error('[sync] failed:', e.message);
  process.exit(1);
});
