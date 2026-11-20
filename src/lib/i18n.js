// UI strings. Each key holds both languages side by side, so a missing translation is easy to spot.
//   • Add a key here, then use it with `app.t('key', { name: value })`; `{name}` placeholders are filled from the params.
//   • Plurals are written { one, other } and chosen with `params.n` (French treats 0 and 1 as "one").
//   • A missing language falls back to English, then to the key itself.
const messages = {
  // ── Page header ───────────────────────────────────────────────────────
  'app.title': { en: 'Tom’s Video Club', fr: 'Le vidéo-club de Tom' },
  'app.subtitle': {
    en: 'Browse the collection and pick what you’d like to borrow',
    fr: 'Parcours la collection et choisis ce que tu aimerais emprunter'
  },
  'app.description': {
    en: 'My blu-ray collection: filter by format, language or subtitles, and pick the films you’d like to borrow.',
    fr: 'Ma collection de blu-rays : filtre par format, langue ou sous-titres, et choisis les films que tu aimerais emprunter.'
  },
  'app.stats': {
    en: '{films} films · {plex} also on Plex',
    fr: '{films} films · {plex} aussi sur Plex'
  },
  lang: { en: 'Language', fr: 'Langue' },
  updated: { en: 'Updated {date}', fr: 'Mis à jour le {date}' },

  // ── Filters ───────────────────────────────────────────────────────────
  'search.label': { en: 'Search', fr: 'Rechercher' },
  'search.placeholder': {
    en: 'Title, director, year…',
    fr: 'Titre, réalisateur, année…'
  },
  'search.clear': { en: 'Clear the search', fr: 'Effacer la recherche' },
  'filter.format': { en: 'Format', fr: 'Format' },
  'filter.language': { en: 'Language', fr: 'Langue' },
  'filter.subs': { en: 'Subtitles', fr: 'Sous-titres' },
  'filter.picks': { en: 'Tom’s picks', fr: 'Coups de cœur de Tom' },
  'filter.more': { en: 'More', fr: 'Plus' },
  'filter.toggle': { en: 'Filters', fr: 'Filtres' },
  'filter.genre': { en: 'Genre', fr: 'Genre' },
  'filter.decade': { en: 'Decade', fr: 'Décennie' },
  'filter.any': { en: 'Any', fr: 'Tous' },
  'filter.all': { en: 'All', fr: 'Tous' },
  'filter.plex': { en: 'Plex', fr: 'Plex' },
  'filter.saga': { en: 'Saga', fr: 'Saga' },
  'filter.distributor': { en: 'Distributor', fr: 'Distributeur' },
  'filter.unset': { en: 'Clear', fr: 'Effacer' },
  'filter.clear': { en: 'Clear filters', fr: 'Effacer les filtres' },
  'lang.other': { en: 'Other', fr: 'Autre' },
  'subs.none': { en: 'None', fr: 'Aucun' },
  'picks.recommended': { en: 'Recommended', fr: 'Recommandés' },
  'picks.fave': { en: 'Absolute faves', fr: 'Coups de cœur' },
  'format.4K': { en: '4K', fr: '4K' },
  'format.BR': { en: 'Blu-ray', fr: 'Blu-ray' },
  'format.3D': { en: '3D', fr: '3D' },
  'format.DVD': { en: 'DVD', fr: 'DVD' },

  // ── Results ───────────────────────────────────────────────────────────
  'results.count': {
    en: { one: '{n} film', other: '{n} films' },
    fr: { one: '{n} film', other: '{n} films' }
  },
  'results.empty': {
    en: 'No film matches these filters.',
    fr: 'Aucun film ne correspond à ces filtres.'
  },
  'sort.label': { en: 'Sort by', fr: 'Trier par' },
  'sort.by': { en: 'Sort by: {sort}', fr: 'Trier par\u00a0: {sort}' },
  'sort.title': { en: 'Title', fr: 'Titre' },
  'sort.director': { en: 'Director', fr: 'Réalisateur' },
  'sort.newest': { en: 'Newest first', fr: 'Plus récents' },
  'sort.oldest': { en: 'Oldest first', fr: 'Plus anciens' },
  'sort.longest': { en: 'Longest first', fr: 'Plus longs' },
  'sort.shortest': { en: 'Shortest first', fr: 'Plus courts' },
  surprise: { en: 'Surprise me', fr: 'Surprends-moi' },
  top: { en: 'Back to top', fr: 'Retour en haut' },

  // ── Film card and details ─────────────────────────────────────────────
  'card.add': { en: 'Add to the borrow list', fr: 'Ajouter à ma liste d’emprunt' },
  'card.remove': { en: 'Remove from the borrow list', fr: 'Retirer de ma liste d’emprunt' },
  'card.open': { en: 'Details of {title}', fr: 'Détails de {title}' },
  'badge.fave': { en: 'Absolute fave', fr: 'Coup de cœur' },
  'badge.recommended': { en: 'Recommended', fr: 'Recommandé' },
  'badge.plex': { en: 'Plex', fr: 'Plex' },
  'detail.close': { en: 'Close', fr: 'Fermer' },
  'detail.original': { en: 'Original title: {title}', fr: 'Titre original\u00a0: {title}' },
  'detail.runtime': { en: 'Runtime', fr: 'Durée' },
  'detail.directors': { en: 'Directed by', fr: 'Réalisé par' },
  'detail.genres': { en: 'Genres', fr: 'Genres' },
  'detail.languages': { en: 'Languages', fr: 'Langues' },
  'detail.spoken': { en: 'Original language', fr: 'Langue originale' },
  'detail.subs': { en: 'Subtitles', fr: 'Sous-titres' },
  'detail.letterboxd': { en: 'Open on Letterboxd', fr: 'Ouvrir sur Letterboxd' },
  'detail.bluray': {
    en: 'View this edition on blu-ray.com',
    fr: 'Voir cette édition sur blu-ray.com'
  },
  'detail.tmdb': { en: 'Open on TMDb', fr: 'Ouvrir sur TMDb' },
  'detail.noSubs': { en: 'no subtitles', fr: 'sans sous-titres' },

  // ── Borrow list ───────────────────────────────────────────────────────
  'tray.title': { en: 'Borrow list', fr: 'Liste d’emprunt' },
  'tray.open': { en: 'Open the borrow list', fr: 'Ouvrir la liste d’emprunt' },
  'tray.close': { en: 'Close', fr: 'Fermer' },
  'tray.pill': {
    en: { one: '{n} film picked', other: '{n} films picked' },
    fr: { one: '{n} film choisi', other: '{n} films choisis' }
  },
  'tray.view': { en: 'View list', fr: 'Voir la liste' },
  'tray.films': { en: 'Films', fr: 'Films' },
  'tray.time': { en: 'Viewing time', fr: 'Durée totale' },
  // the empty list: a line from The Naked Gun (1988), kept in English, with the film's title in the page language
  'tray.empty': { en: '“Nothing to see here!”', fr: '« Circulez, il n’y a rien à voir ! »' },
  'tray.emptyBy': { en: 'Lt. Frank Drebin', fr: 'Lieutenant Frank Drebin' },
  'tray.emptyFilm': {
    en: 'The Naked Gun: From the Files of Police Squad!',
    fr: 'Y a-t-il un flic pour sauver la reine ?'
  },
  'tray.copy': { en: 'Copy the list', fr: 'Copier la liste' },
  'tray.copied': { en: 'List copied to the clipboard', fr: 'Liste copiée dans le presse-papiers' },
  'tray.copyFailed': {
    en: 'Couldn’t copy automatically, please select the text below.',
    fr: 'Copie impossible, sélectionne le texte ci-dessous.'
  },
  'tray.clear': { en: 'Clear', fr: 'Tout retirer' },
  'tray.confirm': { en: 'Remove everything?', fr: 'Tout retirer ?' },
  'tray.remove': { en: 'Remove', fr: 'Retirer' },
  'share.intro': {
    en: { one: 'I’d like to borrow this blu-ray:', other: 'I’d like to borrow these blu-rays:' },
    fr: { one: 'J’aimerais emprunter ce blu-ray :', other: 'J’aimerais emprunter ces blu-rays :' }
  },

  // ── Footer ────────────────────────────────────────────────────────────
  'footer.tmdb': {
    en: 'This site uses the TMDB API but is not endorsed or certified by TMDB.\nPosters and metadata © TMDB.',
    fr: 'Ce site utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.\nAffiches et métadonnées © TMDB.'
  }
};

const pluralRules = {};
const plural = (lang, n) => (pluralRules[lang] ??= new Intl.PluralRules(lang)).select(n);

/** Translate `key` into `lang`, filling `{placeholders}` from `params`. */
export function translate(lang, key, params = {}) {
  const entry = messages[key]?.[lang] ?? messages[key]?.en ?? key;
  const text =
    typeof entry === 'object' ? (entry[plural(lang, params.n ?? 0)] ?? entry.other) : entry;
  return String(text).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
}
