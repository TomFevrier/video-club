# Tom’s Video Club

A mobile-friendly, bilingual (EN/FR) catalogue of my blu-ray collection, for friends and family to browse and
pick what they'd like to borrow. SvelteKit (static), built from a Google Sheet and enriched with TMDb (posters, titles,
runtimes, directors, genres). Same stack and look as the film diary.

- **Browse and filter**: format (4K, Blu-ray, 3D, DVD, Plex), original language, subtitles (EN/FR/none), Tom's picks,
  genre, decade, saga, and a search by title (in English, French or the original), director, year or saga. Sort by title
  (library style: "The", "Le", "L’"… are skipped), director, year or runtime, or let "Surprise me" pick one. The filter
  bar stays at the top of the window; on phones it is a single row whose filters drop down and fold away on scroll.
- **Posters**: English and French films keep their original poster; the others show the poster in the page's language.
  Details (formats, title, year, director) slide in on hover.
- **Borrow list**: tap the ticket on a poster. The list (kept on the visitor's device) shows the total viewing time and
  can be **copied as text** (EN or FR, following the page language) to send by whatever channel they like.
- **Badges**: formats and Plex (4K highlighted), ♥ absolute fave, 👍 recommended, round flags for languages and
  subtitles ([circle-flags](https://github.com/HatScripts/circle-flags)). Films that can't be lent aren't listed.

## How the sheet is read

Only a few columns of the sheet are used, and only what the site shows ever reaches it. Prices, order numbers, who bought
what, and personal ratings stay in the sheet (the ratings are turned into the two pick tiers below).

| Column                               | Used for                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `titre`, `annee`                     | fallback title / year when TMDb has none; also searchable. "Haine (La)" reads "La Haine"         |
| `tmdb_id`                            | the film (rows without a number, such as box sets, are left out; see below)                      |
| `boxd_id`                            | Letterboxd link (`boxd.it/…`)                                                                    |
| `❓`                                 | copies marked ⏳ (not received), ❌ (to sell) or 🫥 (never received) are ignored (`config.json`) |
| `def`, `combo`                       | formats: unique values of both, split on `+`, `HD` = Blu-ray. Bonus discs, booklets, CDs ignored |
| `hdr`                                | Dolby Vision / HDR10 label                                                                       |
| `lang_originale`, `sub_fr`, `sub_en` | languages and subtitles (`Oui`, `SM` and `Partiel` count as available)                           |
| `💾`                                 | **✅ = on Plex.** 💾 alone (still to rip) and ❓ are not                                         |
| `accord_prealable_paul`              | `INTERDIT` = can't be lent (left out when no copy can); anything else = lendable                 |
| `note T`                             | 4 and up = recommended, 4.5 and up = absolute fave (thresholds in `config.json`)                 |

Several rows for one film (editions, copies) become **one film**: formats are combined, and it is as available as its
most available copy. `vente_ou_location` is ignored on purpose.

**Rows left out** (logged on every build): box sets (`Coffret`, titles starting with `0 /`), and rows with no TMDb id,
such as documentaries TMDb doesn't list. Put a TMDb id in the sheet to bring one in.

### Picks not in the sheet

`data/picks.json` holds two lists of TMDb ids for films without a rating (or ones to promote):

```json
{ "recommended": [603], "faves": [] }
```

The higher of the rating and the list wins. It is empty for now.

### Sagas

The saga filter lists the [TMDb collections](https://www.themoviedb.org/collection/87359) with at least 2 films in the
catalogue, so new sequels join their saga on their own. TMDb doesn't group everything (Park Chan-wook's Vengeance
trilogy, for instance), so `data/sagas.json` adds series by TMDb film ids, renames a collection, or leaves one out:

```json
{
  "sagas": [
    {
      "name": { "en": "Vengeance Trilogy", "fr": "Trilogie de la vengeance" },
      "films": [4689, 670, 4550]
    }
  ],
  "names": { "123800": { "en": "Before Trilogy", "fr": "Trilogie Before" } },
  "exclude": [41649]
}
```

Every build logs the sagas it found, with their number of films.

## Setup (same as the film diary)

1. **Share the sheet**: "Anyone with the link can view". `SHEET_CSV_URL` can then be the export link
   `https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=0` (a plain sheet link also works). Note that this
   shares the _whole_ sheet, prices included, with anyone who has the link.
2. **TMDb key**: <https://www.themoviedb.org/settings/api>, copy the API Read Access Token (or v3 key).
3. **Push to GitHub, then Netlify → Import from GitHub.** `netlify.toml` has the build settings.
4. **Site configuration → Environment variables**: `SHEET_CSV_URL` and `TMDB_API_KEY`.
5. **Scheduled refresh**: add a Netlify build hook as the GitHub secret `NETLIFY_BUILD_HOOK`;
   `.github/workflows/refresh.yml` rebuilds once a day (04:23 UTC), and on demand from its _Run workflow_ button. TMDb
   lookups are cached (`.cache`), so only new films cost API calls.
6. **Serve it at `tomfevrier.io/video-club/`**: add to the main site's `netlify.toml`, as for the film diary, two proxy
   rules (`200`, never `301`):

   ```toml
   [[redirects]]
     from = "/video-club"
     to = "https://<this-site>.netlify.app/"
     status = 200

   [[redirects]]
     from = "/video-club/*"
     to = "https://<this-site>.netlify.app/:splat"
     status = 200
   ```

   `netlify.toml` here sets `BASE_PATH=/video-club` (empty on branch deploys), and rewrites `/video-club/…` to the root so
   the site's own `*.netlify.app` address works too. Using another path? Change it there, in the rules above and in
   `siteUrl` (`config.json`, the absolute address used by the canonical link and link previews).

## Local use

```bash
pnpm install
cp .env.example .env     # optional: SHEET_CSV_URL, TMDB_API_KEY
pnpm dev                 # syncs, then serves http://localhost:5173
pnpm check               # prettier + eslint + tests
```

Without `SHEET_CSV_URL` it reads `data/blu-rays.csv` (git-ignored: drop your own export there). Without
`TMDB_API_KEY`, only what is already in the TMDb cache (`.cache/`) is used: new films get the sheet's title and year
alone.

`?lang=fr` forces the language (otherwise the browser's language, English by default).

## Languages and link previews

There are two prerendered pages, since link-preview crawlers don't run JavaScript: `tomfevrier.io/video-club/` (English)
and `…/video-club/fr/` (French), each with its own title, description, `<html lang>`, `hreflang` links and preview image.
Share the French one with French speakers. In the browser, `?lang=` still wins, then the page's language (`/fr/`), then
the browser's language on the main page.

`scripts/og.mjs` (run by `dev` and `build`, after the sync) draws the 1200×630 preview image, one per language: a
bookcase of three shelves beside the title. The 15 cases facing out are the films listed in `config.json → og.faces`
(TMDb ids, row by row, five per shelf), with their posters in that language; the spines between them are other faves
and recommended films whose title fits along the spine. Blue for blu-ray, black for 4K. If a listed film is missing or
has no blu-ray, the build log says so and another fave takes its place. `node scripts/og.mjs --preview <folder>` draws
both languages into a folder to look at. The images (`static/og/`, hashed names) and `src/lib/data/og.json` are
generated, not committed; if drawing fails the build carries on without an `og:image`. After changing the card, refresh Facebook's cache with its Sharing Debugger.
