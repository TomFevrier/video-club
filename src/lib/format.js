// Number, date and duration formatting per language (Intl, so FR gets non-breaking thin spaces and so on).
const cache = {};

export function makeFormats(lang) {
  if (cache[lang]) return cache[lang];
  const int = new Intl.NumberFormat(lang).format;
  const date = new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format;
  /** minutes -> "2h 05m" / "2 h 05" */
  const duration = (min) => {
    const h = Math.floor(min / 60);
    const m = String(min % 60).padStart(2, '0');
    if (h === 0) return lang === 'fr' ? `${min} min` : `${min}m`;
    return lang === 'fr' ? `${int(h)} h ${m}` : `${int(h)}h ${m}m`;
  };
  return (cache[lang] = { int, date, duration });
}
