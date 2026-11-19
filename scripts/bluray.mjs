#!/usr/bin/env node
// Finds the blu-ray.com page of every copy in the sheet, from its EAN (barcode). Run by hand, not part of the sync:
//
//   npm run bluray                 look up the copies not looked up yet
//   npm run bluray -- --limit 20   only the first 20 of them
//   npm run bluray -- --retry      also try again the ones that found nothing or several pages
//   npm run bluray -- --headed     show the browser (if the site starts asking whether you're a robot)
//
// blu-ray.com turns away plain HTTP clients (curl, fetch: "error42"), so this drives the installed Google Chrome
// through playwright-core, slowly (a few seconds between searches). Searching an EAN that matches a single disc
// redirects straight to its page; several matches give a results list, narrowed down by format and year.
//
// Results go to data/bluray.json (git-ignored), keyed by EAN, saved after every lookup: stop it any time and run it
// again later.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { parseCsv, parseNumber } from './lib.mjs';
import { loadDotEnv, readSheet } from './sheet.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'data/bluray.json');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const log = (...a) => console.log('[bluray]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(4000 + Math.random() * 3000); // be gentle with the site

const args = process.argv.slice(2);
const retry = args.includes('--retry');
const headed = args.includes('--headed');
const limit = +(args[args.indexOf('--limit') + 1] || 0) || Infinity;

loadDotEnv(root);

/** The sheet's copies that have an EAN: one per barcode. */
function copies(rows) {
  const byEan = new Map();
  for (const r of rows) {
    const ean = (r.ean ?? '').replace(/\D/g, '');
    if (!/^\d{12,13}$/.test(ean) || byEan.has(ean)) continue;
    if ((config.skipMarkers ?? []).some((m) => (r['❓'] ?? '').includes(m))) continue; // not in the collection
    byEan.set(ean, {
      ean,
      title: (r.titre ?? '').trim(),
      year: parseNumber(r.annee),
      tmdbId: /^\d+$/.test(r.tmdb_id ?? '') ? +r.tmdb_id : null,
      format: (r.def ?? '').trim() // 4K, HD (Blu-ray), 3D, DVD
    });
  }
  return [...byEan.values()];
}

const searchUrl = (copy) =>
  'https://www.blu-ray.com/search/?' +
  new URLSearchParams({
    quicksearch: 1,
    quicksearch_country: 'all',
    quicksearch_keyword: copy.ean,
    section: /dvd/i.test(copy.format) ? 'dvdmovies' : 'bluraymovies'
  });

/** A disc page's URL ends in /movies/<slug>/<id>/. */
const DISC = /^https:\/\/www\.blu-ray\.com\/(movies|dvd)\/[^/]+\/\d+\/$/;
const is4K = (s) => /4K/.test(s);

async function lookUp(page, copy) {
  await page.goto(searchUrl(copy), { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  if (html.length < 1000) throw new Error(`blocked by the site (${html.trim().slice(0, 40)})`);

  // a single match: the search redirected to the disc's page
  if (DISC.test(page.url())) {
    const name = (await page.title()).replace(/\s*\|.*$/, '');
    // the page doesn't show the EAN: flag the ones whose format doesn't match the sheet's
    const check = is4K(copy.format) !== is4K(page.url());
    return { status: 'found', url: page.url(), name, ...(check && { check: 'format differs' }) };
  }

  // several: the results are the links with a title ("Speed Racer 4K (2008)"); the sidebar's have none
  const candidates = await page.$$eval('a[title]', (as) =>
    as.map((a) => ({ url: a.href, name: a.title })).filter((c) => /\(\d{4}/.test(c.name))
  );
  const unique = [
    ...new Map(candidates.filter((c) => DISC.test(c.url)).map((c) => [c.url, c])).values()
  ];
  if (!unique.length) return { status: 'none' };
  const narrowed = unique.filter(
    (c) => is4K(c.name) === is4K(copy.format) && (!copy.year || c.name.includes(`(${copy.year}`))
  );
  if (narrowed.length === 1)
    return { status: 'found', ...narrowed[0], check: 'picked from several' };
  return { status: 'several', candidates: unique.slice(0, 10) };
}

async function main() {
  const results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const save = () => fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');

  const all = copies(parseCsv(await readSheet(root, log)));
  const todo = all
    .filter((c) => !results[c.ean] || (retry && results[c.ean].status !== 'found'))
    .slice(0, limit);
  log(
    `${all.length} copies with an EAN, ${all.length - todo.length} already done, ${todo.length} to look up`
  );
  if (!todo.length) return;

  const browser = await chromium.launch({ channel: 'chrome', headless: !headed });
  const page = await (await browser.newContext({ locale: 'en-US' })).newPage();
  const count = { found: 0, several: 0, none: 0 };
  try {
    for (const [i, copy] of todo.entries()) {
      if (i) await pause();
      const r = await lookUp(page, copy);
      results[copy.ean] = {
        title: copy.title,
        tmdbId: copy.tmdbId,
        format: copy.format,
        ...r,
        at: new Date().toISOString().slice(0, 10)
      };
      save();
      count[r.status]++;
      log(
        `${i + 1}/${todo.length}`,
        copy.ean,
        copy.title,
        '->',
        r.status,
        r.name ?? '',
        r.check ? `(${r.check})` : ''
      );
    }
  } catch (e) {
    log('stopped:', e.message, '- what was found so far is saved; run again later');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  log(
    `found ${count.found}, several ${count.several}, nothing ${count.none} -> ${path.relative(root, OUT)}`
  );
}

main().catch((e) => {
  console.error('[bluray] failed:', e.message);
  process.exit(1);
});
