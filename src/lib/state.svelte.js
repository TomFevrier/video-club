import { replaceState } from '$app/navigation';
import raw from './data/movies.json';
import { makeFormats } from './format.js';
import { translate } from './i18n.js';
import config from '../../config.json';

export const generatedAt = raw.generatedAt;
export const movies = raw.films;
export const sagas = raw.sagas ?? [];
export const FORMATS = ['4K', 'BR', '3D', 'DVD'];

const STORAGE_KEY = 'video-club.borrow-list';

/** Lower case, no accents or apostrophes: "L’Été" and "ete" meet. */
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’']/g, ' ')
    .toLowerCase();
/**
 * Library-style sort key of a title in a page language: no leading punctuation ("…And God Created Woman", "[REC]") and
 * no leading article ("The Matrix" under M, "L’Été" under E). Each language skips its own articles, plus the other's
 * when titles are left untranslated ("La Haine" in English, "The Dark Knight" in French). French doesn't skip "A":
 * capitals often lose their accent, and "A bout de souffle" is "À bout de souffle".
 */
const ARTICLES = {
  en: /^(?:(?:the|an?|le|la|les)\s+|l['’]\s*)/i,
  fr: /^(?:(?:the|le|la|les|un|une|des)\s+|l['’]\s*)/i
};
const PUNCTUATION = /^[^\p{L}\p{N}]+/u;
const sortKey = (title, lang) =>
  title.trim().replace(PUNCTUATION, '').replace(ARTICLES[lang], '').replace(PUNCTUATION, '');
const collators = {};
const collate = (lang) =>
  (collators[lang] ??= new Intl.Collator(lang, {
    sensitivity: 'base',
    numeric: true,
    ignorePunctuation: true
  })).compare;
const decadeOf = (m) => (m.year ? Math.floor(m.year / 10) * 10 : null);

const sagaById = new Map(sagas.map((s) => [s.id, s]));

// plain (non-reactive) data, computed once at module load
for (const m of movies) {
  const saga = sagaById.get(m.saga);
  m.search = norm(
    [
      m.titles.en,
      m.titles.fr,
      m.alt,
      m.originalTitle,
      m.year,
      ...m.directors,
      ...m.genres,
      saga?.name.en,
      saga?.name.fr,
      ...(m.distributors ?? [])
    ].join(' ')
  );
  m.sortKey = { en: sortKey(m.titles.en, 'en'), fr: sortKey(m.titles.fr ?? m.titles.en, 'fr') };
}
const byId = new Map(movies.map((m) => [m.id, m]));
// plain (non-reactive) sets: only used once, at module load
// eslint-disable-next-line svelte/prefer-svelte-reactivity
export const decades = [...new Set(movies.map(decadeOf).filter(Boolean))].sort((a, b) => b - a);
// eslint-disable-next-line svelte/prefer-svelte-reactivity
export const genres = [...new Set(movies.flatMap((m) => m.genres))].sort();
/** Distributors ("editeur" in the sheet) with 2 films or more: the others would make a long, mostly useless list. */
const distributorCount = {};
for (const p of movies.flatMap((m) => m.distributors ?? []))
  distributorCount[p] = (distributorCount[p] ?? 0) + 1;
export const distributors = Object.keys(distributorCount)
  .filter((p) => distributorCount[p] >= 2)
  .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
export const plexCount = movies.filter((m) => m.plex).length;

/** The browser's language: the first of navigator.languages that is English or French, otherwise English. */
function browserLang() {
  for (const l of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const base = String(l).toLowerCase().split('-')[0];
    if (base === 'fr' || base === 'en') return base;
  }
  return 'en';
}

/** Mirror a choice in the URL (?lang=…) without adding a history entry. */
function syncParam(name, value) {
  try {
    const url = new URL(location.href);
    url.searchParams.set(name, value);
    // the URL comes from location.href, so it already contains the base path: resolve() would add it twice
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    replaceState(url, {});
  } catch {
    // the router isn't ready (or this isn't a browser): the URL just isn't updated
  }
}

const byTitle = (a, b, lang) => collate(lang)(a.sortKey[lang], b.sortKey[lang]);
const SORTS = {
  title: byTitle,
  director: (a, b, lang) =>
    collate(lang)(a.directors[0] ?? '\uffff', b.directors[0] ?? '\uffff') || byTitle(a, b, lang),
  newest: (a, b, lang) => (b.year ?? 0) - (a.year ?? 0) || byTitle(a, b, lang),
  oldest: (a, b, lang) => (a.year ?? 9999) - (b.year ?? 9999) || byTitle(a, b, lang),
  longest: (a, b) => (b.runtime ?? 0) - (a.runtime ?? 0),
  shortest: (a, b) => (a.runtime ?? 9999) - (b.runtime ?? 9999)
};
export const sortOptions = Object.keys(SORTS);

const GENRES_FR = {
  Action: 'Action',
  Adventure: 'Aventure',
  Animation: 'Animation',
  Comedy: 'Comédie',
  Crime: 'Crime',
  Documentary: 'Documentaire',
  Drama: 'Drame',
  Family: 'Familial',
  Fantasy: 'Fantastique',
  History: 'Histoire',
  Horror: 'Horreur',
  Music: 'Musique',
  Mystery: 'Mystère',
  Romance: 'Romance',
  'Science Fiction': 'Science-Fiction',
  'TV Movie': 'Téléfilm',
  Thriller: 'Thriller',
  War: 'Guerre',
  Western: 'Western'
};

/** The card's blink (Card.svelte, .flash: 3 × 0.7s). */
const BLINK_MS = 2100;
/**
 * Smooth-scrolls an element to the middle of the screen; resolves once scrolling has stopped (no scroll event for
 * 150ms, which also covers "already there" and Safari before `scrollend`).
 */
function scrollTo(el) {
  return new Promise((done) => {
    if (!el) return done();
    let idle;
    const wait = () => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        removeEventListener('scroll', wait);
        done();
      }, 150);
    };
    addEventListener('scroll', wait, { passive: true });
    wait();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

class App {
  lang = $state('en');

  // filters
  query = $state('');
  formats = $state([]); // any of FORMATS (a film matches when it comes in at least one of them)
  language = $state('all'); // all | en | fr | other
  subs = $state('any'); // any | en | fr | none
  picks = $state('all'); // all | recommended | fave
  plex = $state(false);
  genre = $state('');
  decade = $state('');
  saga = $state(''); // a saga id from `sagas`
  distributor = $state(''); // one of `distributors`
  sort = $state('title');
  filtersOpen = $state(false); // phones only: the filters fold away to leave room for the films

  // borrow list (ids), the open film, the list panel, a short message, the film flashed by "surprise me"
  selection = $state([]);
  detail = $state(null);
  trayOpen = $state(false);
  toast = $state('');
  highlight = $state(null);

  t = (key, params) => translate(this.lang, key, params);
  get fmt() {
    return makeFormats(this.lang);
  }
  /** Title in the page's language, with typographic apostrophes. */
  title = (m) => (m.titles[this.lang] ?? m.titles.en).replace(/'/g, '’');
  formatName = (f) => this.t(`format.${f}`);
  languageName = (code) => {
    try {
      return new Intl.DisplayNames([this.lang], { type: 'language' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  genreName = (g) => (this.lang === 'fr' ? (GENRES_FR[g] ?? g) : g);
  sagaName = (id) => (sagaById.get(id)?.name[this.lang] ?? '').replace(/'/g, '’');

  // ── filtering ─────────────────────────────────────────────────────────
  matches = (m) => {
    if (this.formats.length && !m.formats.some((f) => this.formats.includes(f))) return false;
    if (this.language === 'other') {
      if (['en', 'fr'].includes(m.language)) return false;
    } else if (this.language !== 'all' && m.language !== this.language) return false;
    if (this.subs === 'none') {
      if (m.subtitles.fr || m.subtitles.en) return false;
    } else if (this.subs !== 'any' && !m.subtitles[this.subs]) return false;
    if (this.picks === 'fave' ? m.tier !== 'fave' : this.picks === 'recommended' && !m.tier)
      return false;
    if (this.plex && !m.plex) return false;
    if (this.genre && !m.genres.includes(this.genre)) return false;
    if (this.decade && decadeOf(m) !== +this.decade) return false;
    if (this.saga && m.saga !== this.saga) return false;
    if (this.distributor && !m.distributors?.includes(this.distributor)) return false;
    const words = norm(this.query).split(/\s+/).filter(Boolean);
    return words.every((w) => m.search.includes(w));
  };

  visible = $derived.by(() => {
    const cmp = SORTS[this.sort];
    return movies.filter(this.matches).sort((a, b) => cmp(a, b, this.lang));
  });

  get activeFilters() {
    return (
      this.formats.length +
      (this.language !== 'all') +
      (this.subs !== 'any') +
      (this.picks !== 'all') +
      this.plex +
      !!this.genre +
      !!this.decade +
      !!this.saga +
      !!this.distributor +
      !!this.query.trim()
    );
  }
  resetFilters() {
    this.query = '';
    this.formats = [];
    this.language = 'all';
    this.subs = 'any';
    this.picks = 'all';
    this.plex = false;
    this.genre = '';
    this.decade = '';
    this.saga = '';
    this.distributor = '';
  }
  /** A saga reads best in release order: picking one switches the sort (it can be changed back). */
  setSaga(id) {
    this.saga = id;
    if (id) this.sort = 'oldest';
  }
  toggleFormat(f) {
    this.formats = this.formats.includes(f)
      ? this.formats.filter((x) => x !== f)
      : [...this.formats, f];
  }

  /** Scroll to a random film of the current results and flash it. */
  // scroll to a random film, make it blink once there, then open its details
  #surprise = null; // the latest draw: a second click while one runs takes over
  async surprise() {
    const pool = this.visible;
    if (!pool.length) return;
    const m = pool[Math.floor(Math.random() * pool.length)];
    const draw = (this.#surprise = {});
    this.highlight = null;
    await scrollTo(document.getElementById(`m${m.id}`));
    if (this.#surprise !== draw) return;
    this.highlight = m.id;
    await new Promise((r) => setTimeout(r, BLINK_MS));
    if (this.#surprise !== draw) return;
    this.highlight = null;
    this.detail = m;
  }

  // ── borrow list ───────────────────────────────────────────────────────
  get picked() {
    return this.selection.map((id) => byId.get(id)).filter(Boolean);
  }
  isPicked = (m) => this.selection.includes(m.id);
  toggle(m) {
    this.selection = this.isPicked(m)
      ? this.selection.filter((id) => id !== m.id)
      : [...this.selection, m.id];
    this.save();
  }
  clearSelection() {
    this.selection = [];
    this.trayOpen = false;
    this.save();
  }
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.selection));
    } catch {
      // private mode or storage blocked: the list just doesn't survive a reload
    }
  }

  /** The list as plain text, in the page's language, ready to paste into any message. */
  listText() {
    const items = this.picked;
    const lines = items.map((m, i) => {
      const formats = [...m.formats.map(this.formatName), ...(m.plex ? ['Plex'] : [])].join(', ');
      return `${i + 1}. ${this.title(m)}${m.year ? ` (${m.year})` : ''}${formats ? ` – ${formats}` : ''}`;
    });
    const intro = this.t('share.intro', { n: items.length });
    return [intro, '', ...lines, ...(config.siteUrl ? ['', config.siteUrl] : [])].join('\n');
  }

  notify(message) {
    this.toast = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 2600);
  }

  // ── language ──────────────────────────────────────────────────────────
  applyLang(l) {
    this.lang = l;
    if (typeof document !== 'undefined') document.documentElement.lang = l;
  }
  setLang(l) {
    this.applyLang(l);
    syncParam('lang', l);
  }

  /**
   * Initial state: ?lang=fr|en, else the page's own language (the /fr/ page), else the browser's; and the borrow list
   * saved on this device.
   */
  init(pageLang = null) {
    const lang = new URLSearchParams(location.search).get('lang')?.toLowerCase();
    this.applyLang(lang === 'fr' || lang === 'en' ? lang : (pageLang ?? browserLang()));
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      this.selection = saved.filter((id) => byId.has(id));
    } catch {
      this.selection = [];
    }
  }
}

export const app = new App();
