// Reading the Google Sheet, shared by sync.mjs and bluray.mjs.
import fs from 'node:fs';
import path from 'node:path';

/** Loads `.env` from the project root into process.env (variables already set win). */
export function loadDotEnv(root) {
  const f = path.join(root, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env) && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** Accepts a "publish to web" link, an export link, a sheet edit link (shared by link), or a local path. */
function toCsvUrl(u) {
  if (/output=csv|format=csv|tqx=out:csv/.test(u)) return u;
  const m = u.match(/spreadsheets\/d\/([\w-]+)/);
  if (!m || m[1] === 'e') return u;
  const gid = u.match(/gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

/** The sheet as CSV text: from SHEET_CSV_URL (a link or a local path), else data/blu-rays.csv. */
export async function readSheet(root, log = () => {}) {
  const { SHEET_CSV_URL } = process.env;
  if (SHEET_CSV_URL && /^https?:/.test(SHEET_CSV_URL)) {
    const res = await fetch(toCsvUrl(SHEET_CSV_URL), { redirect: 'follow' });
    if (!res.ok)
      throw new Error(
        `Sheet download failed: HTTP ${res.status} (is it shared by link / published?)`
      );
    const text = await res.text();
    if (/^\s*<(!doctype|html)/i.test(text))
      throw new Error(
        'Sheet URL returned HTML, not CSV (share the sheet by link or publish it as CSV).'
      );
    log('sheet: downloaded from Google Sheets');
    return text;
  }
  for (const c of [SHEET_CSV_URL, 'data/blu-rays.csv'].filter(Boolean)) {
    const f = path.resolve(root, c);
    if (fs.existsSync(f)) {
      log('sheet: reading', path.relative(root, f));
      return fs.readFileSync(f, 'utf8');
    }
  }
  throw new Error('No data: set SHEET_CSV_URL or add data/blu-rays.csv');
}
