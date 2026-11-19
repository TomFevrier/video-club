import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv,
  parseNumber,
  parseFormats,
  hasSubtitles,
  parseLanguage,
  parseHdr,
  lendable,
  parseDistributor,
  readableTitle,
  tierFromRating,
  groupFilms,
  pickPoster,
  normaliseLanguage,
  cleanCollectionName,
  buildSagas,
  languageFlags
} from './lib.mjs';

const config = {
  skipMarkers: ['⏳', '❌', '🫥'],
  picks: { faveMin: 4.5, recommendedMin: 4 }
};
const row = (o) => ({
  titre: 'Film',
  annee: '2000',
  tmdb_id: '1',
  boxd_id: 'abcd',
  '❓': '💜',
  def: 'HD',
  combo: '',
  ...o
});

test('parseCsv trims, strips the BOM and drops empty rows', () => {
  const rows = parseCsv('﻿titre , annee\n Alien ,1979\n,\n');
  assert.deepEqual(rows, [{ titre: 'Alien', annee: '1979' }]);
});

test('parseNumber reads decimal commas', () => {
  assert.equal(parseNumber('4,5'), 4.5);
  assert.equal(parseNumber('3'), 3);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('x'), null);
});

test('formats: the sheet formula (HD = BR, split on +, unique), ignoring non-discs', () => {
  assert.deepEqual(parseFormats('HD', ''), ['BR']);
  assert.deepEqual(parseFormats('4K', '4K + BR + bonus'), ['4K', 'BR']);
  assert.deepEqual(parseFormats('HD', 'BR 3D + DVD'), ['BR', '3D', 'DVD']);
  assert.deepEqual(parseFormats('HD', 'BR + livret + jeu de société'), ['BR']);
  assert.deepEqual(parseFormats('4K', '4K + BR (theatrical + director’s cut)'), ['4K', 'BR']);
  assert.deepEqual(parseFormats('DVD', ''), ['DVD']);
  assert.deepEqual(parseFormats('?', ''), []);
});

test('subtitles, languages and HDR', () => {
  assert.ok(hasSubtitles('Oui') && hasSubtitles('SM') && hasSubtitles('Partiel'));
  assert.ok(!hasSubtitles('Non') && !hasSubtitles(''));
  assert.equal(parseLanguage('EN'), 'en');
  assert.equal(parseLanguage('CN'), 'zh');
  assert.equal(parseLanguage('ZH/CN'), 'zh');
  assert.equal(parseLanguage('JP'), 'ja');
  assert.equal(parseLanguage(''), null);
  assert.equal(parseHdr('Dolby Vision'), 'Dolby Vision');
  assert.equal(parseHdr('HDR10 ?'), 'HDR10');
  assert.equal(parseHdr('N/A (ordre de David Lynch)'), null);
});

test('lending rules and tiers', () => {
  assert.equal(lendable('INTERDIT'), false);
  assert.equal(lendable('Oui'), true);
  assert.equal(lendable('Maybe'), true);
  assert.equal(lendable(''), true);
  assert.equal(tierFromRating(5), 'fave');
  assert.equal(tierFromRating(4.5), 'fave');
  assert.equal(tierFromRating(4), 'recommended');
  assert.equal(tierFromRating(4.1), 'recommended');
  assert.equal(tierFromRating(3.5), null);
  assert.equal(tierFromRating(null), null);
});

test('rows become one entry per film; skipped rows are counted', () => {
  const rows = [
    row({ titre: '0 / Coffret', tmdb_id: 'Coffret' }),
    row({ titre: '0 / Coffret sans id', tmdb_id: '' }),
    row({ titre: '0' }),
    row({ titre: 'Not received', tmdb_id: '2', '❓': '⏳' }),
    row({ titre: 'To sell', tmdb_id: '3', '❓': '❌' }),
    row({ titre: 'Never came', tmdb_id: '4', '❓': '🫥' }),
    row({ titre: 'A documentary', tmdb_id: '' }),
    row({ titre: 'Alien', tmdb_id: '348', annee: '1979' })
  ];
  const { films, skipped } = groupFilms(rows, { config });
  assert.deepEqual(
    films.map((f) => f.id),
    [348]
  );
  assert.equal(skipped.excluded, 3);
  assert.equal(skipped.boxes, 2);
  assert.deepEqual(skipped.unmatched, ['A documentary']);
});

test('editions of a film are merged', () => {
  const rows = [
    row({
      tmdb_id: '269',
      def: 'DVD',
      'zone(s)': '2',
      accord_prealable_paul: 'INTERDIT',
      'note T': '3'
    }),
    row({
      tmdb_id: '269',
      def: '4K',
      combo: '4K + BR',
      sub_fr: 'Oui',
      accord_prealable_paul: 'Oui',
      'note T': '4,5',
      '💾': '✅'
    }),
    row({ tmdb_id: '269', '❓': '⏳', def: '3D' }) // not received: ignored
  ];
  const { films } = groupFilms(rows, { config });
  assert.equal(films.length, 1);
  const [f] = films;
  assert.deepEqual(f.formats, ['4K', 'BR', 'DVD']);
  assert.equal('lendable' in f, false); // one lendable copy is enough, and the flag isn't published
  assert.equal(f.tier, 'fave');
  assert.ok(f.plex && f.subtitles.fr && !f.subtitles.en);
  assert.equal('rating' in f, false); // personal ratings are never published
});

test('distributors lose the one in brackets', () => {
  assert.equal(
    parseDistributor('StudioCanal (distribué par Universal Pictures Vidéo (France) SAS)'),
    'StudioCanal'
  );
  assert.equal(parseDistributor(' Carlotta '), 'Carlotta');
  assert.equal(parseDistributor(''), null);
  const { films } = groupFilms(
    [
      row({ editeur: 'Wild Side' }),
      row({ editeur: 'Wild Side (distribué par Universal)' }),
      row({ editeur: 'BFI' })
    ],
    { config }
  );
  assert.deepEqual(films[0].distributors, ['Wild Side', 'BFI']);
});

test('a film without a lendable copy is left out', () => {
  const { films, skipped } = groupFilms([row({ accord_prealable_paul: 'INTERDIT' })], { config });
  assert.equal(films.length, 0);
  assert.equal(skipped.unlendable, 1);
});

test('library-style titles are put back in reading order', () => {
  assert.equal(readableTitle('Haine (La)'), 'La Haine');
  assert.equal(readableTitle('Truman Show (The)'), 'The Truman Show');
  assert.equal(readableTitle('Homme de Fer (L’)'), 'L’Homme de Fer');
  assert.equal(readableTitle('Schtroumpfs 2 (Les)'), 'Les Schtroumpfs 2');
  assert.equal(
    readableTitle('Amélie Poulain (Le Fabuleux Destin d’)'),
    'Le Fabuleux Destin d’Amélie Poulain'
  );
  assert.equal(readableTitle('Bridget Jones (Le Journal de)'), 'Le Journal de Bridget Jones');
  assert.equal(readableTitle('Pinocchio (Guillermo del Toro’s)'), 'Guillermo del Toro’s Pinocchio');
  // brackets that belong to the title, or translate it, stay
  for (const t of ['JSA (Joint Security Area)', 'Frontière(s)', 'Rear Window (Fenêtre sur cour)'])
    assert.equal(readableTitle(t), t);
});

test('Plex = ✅ only; 💾 is still to rip', () => {
  const plex = (v) => groupFilms([row({ '💾': v })], { config }).films[0].plex;
  assert.equal(plex('✅'), true);
  assert.equal(plex('✅↗️'), true);
  assert.equal(plex('✅🇯🇵'), true);
  assert.equal(plex('💾'), false);
  assert.equal(plex('❓'), false);
  assert.equal(plex(''), false);
});

test('manual picks complete the ratings; the higher tier wins', () => {
  const rows = [
    row({ tmdb_id: '10' }),
    row({ tmdb_id: '11', 'note T': '4' }),
    row({ tmdb_id: '12', 'note T': '2,1' })
  ];
  const picks = { recommended: [10, 12], faves: [11] };
  const tiers = Object.fromEntries(
    groupFilms(rows, { config, picks }).films.map((f) => [f.id, f.tier])
  );
  assert.deepEqual(tiers, { 10: 'recommended', 11: 'fave', 12: 'recommended' });
});

test('posters: English on the English page when there is one; on the French page, the original or French one', () => {
  const images = {
    posters: [
      { iso_639_1: 'en', file_path: '/en.jpg', vote_average: 5 },
      { iso_639_1: 'fr', file_path: '/fr.jpg', vote_average: 5 },
      { iso_639_1: 'ko', file_path: '/ko.jpg', vote_average: 9 }
    ]
  };
  const noEnglish = { posters: images.posters.filter((p) => p.iso_639_1 !== 'en') };
  // English page: English whenever it exists, whatever the film's language
  assert.equal(pickPoster(images, 'fr', 'en', '/d.jpg'), '/en.jpg');
  assert.equal(pickPoster(images, 'ko', 'en', '/d.jpg'), '/en.jpg');
  assert.equal(pickPoster(images, 'ko', 'en', '/d.jpg', 'always-original'), '/en.jpg');
  // ...otherwise the original language, then French
  assert.equal(pickPoster(noEnglish, 'ko', 'en', '/d.jpg'), '/ko.jpg');
  assert.equal(pickPoster(noEnglish, 'fr', 'en', '/d.jpg'), '/fr.jpg');
  // French page: English and French films keep their original poster, the others get the French one
  assert.equal(pickPoster(images, 'fr', 'fr', '/d.jpg'), '/fr.jpg');
  assert.equal(pickPoster(images, 'en', 'fr', '/d.jpg'), '/en.jpg');
  assert.equal(pickPoster(images, 'ko', 'fr', '/d.jpg'), '/fr.jpg');
  assert.equal(pickPoster(images, 'ko', 'fr', '/d.jpg', 'always-original'), '/ko.jpg');
  // nothing in any of these languages: TMDb's default poster
  assert.equal(pickPoster({ posters: [] }, 'ja', 'fr', '/d.jpg'), '/d.jpg');
});

test('languages', () => {
  assert.equal(normaliseLanguage('cn'), 'yue');
  assert.equal(normaliseLanguage('ja'), 'ja');
});

test('collection names lose what TMDb adds around them', () => {
  assert.equal(cleanCollectionName('John Wick Collection'), 'John Wick');
  assert.equal(cleanCollectionName('Mission : Impossible - Saga'), 'Mission : Impossible');
  assert.equal(cleanCollectionName('Collection Alien'), 'Alien');
  assert.equal(cleanCollectionName('Detective Dee Collection (Tsui Hark)'), 'Detective Dee');
  assert.equal(cleanCollectionName('Troll (1986)'), 'Troll');
  assert.equal(cleanCollectionName('Doctor Who (Peter Cushing) Collection'), 'Doctor Who');
  assert.equal(cleanCollectionName('Before... Collection'), 'Before…');
  assert.equal(cleanCollectionName('La Vengeance Trilogie'), 'La Vengeance Trilogie');
});

test('sagas: TMDb collections with 2+ films, manual ones win, renames and exclusions', () => {
  const films = [
    { id: 1, collection: { id: 10, name: 'John Wick Collection' } },
    { id: 2, collection: { id: 10, name: 'John Wick Collection' } },
    { id: 3, collection: { id: 20, name: 'Lonely Collection' } },
    { id: 4, collection: { id: 30, name: 'Old Boy Collection' } },
    { id: 5, collection: null },
    { id: 6, collection: { id: 40, name: 'Hidden Collection' } },
    { id: 7, collection: { id: 40, name: 'Hidden Collection' } }
  ];
  const manual = {
    sagas: [{ name: { en: 'Vengeance Trilogy', fr: 'Trilogie de la vengeance' }, films: [4, 5] }],
    names: { 10: { fr: 'Saga John Wick' } },
    exclude: [40]
  };
  const { sagas, sagaOf } = buildSagas(films, { 10: { fr: 'John Wick - Saga' } }, manual);
  assert.deepEqual(sagas, [
    { id: 'c10', name: { en: 'John Wick', fr: 'Saga John Wick' }, count: 2 },
    {
      id: 'm-vengeance-trilogy',
      name: { en: 'Vengeance Trilogy', fr: 'Trilogie de la vengeance' },
      count: 2
    }
  ]);
  assert.equal(sagaOf.get(1), 'c10');
  assert.equal(sagaOf.get(3), undefined); // only one film
  assert.equal(sagaOf.get(4), 'm-vengeance-trilogy');
  assert.equal(sagaOf.get(6), undefined); // excluded
});

test('flags follow aliases and fall back to a country', () => {
  const iconset = {
    width: 512,
    height: 512,
    icons: {
      'lang-en': { body: '<g id="en"/>' },
      fx: { body: '<g id="fr"/>' },
      hk: { body: '<g id="hk"/>' }
    },
    aliases: { 'lang-fr': { parent: 'fx' } }
  };
  const flags = languageFlags(iconset, ['en', 'fr', 'yue', 'xx'], { yue: 'hk' });
  assert.deepEqual(Object.keys(flags), ['en', 'fr', 'yue']);
  assert.match(flags.fr, /^<svg [^>]*viewBox="0 0 512 512"><g id="fr"\/><\/svg>$/);
});
