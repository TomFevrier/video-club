// The prerendered pages declare their language (<html lang>): French for /fr/, English otherwise.
// In the browser, switching language updates it (state.svelte.js → applyLang).
export const handle = ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('%lang%', /\/fr\/?$/.test(event.url.pathname) ? 'fr' : 'en')
  });
