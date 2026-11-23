import fs from 'node:fs';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const FILE = new URL('./data/posters.json', import.meta.url);

/**
 * Dev server only: the popup's poster picker saves its choices to data/posters.json (GET reads them, POST sets or
 * clears one), which the next sync applies. Nothing of this exists in the built site.
 */
function posterPicks() {
  const read = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const picks = () => Object.fromEntries(Object.entries(read()).filter(([k]) => k !== '_'));
  return {
    name: 'poster-picks',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__posters', (req, res) => {
        const send = (code, body) => {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method === 'GET') return send(200, picks());
        if (req.method !== 'POST') return send(405, { error: 'GET or POST only' });
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { id, lang, path } = JSON.parse(body);
            if (!/^\d+$/.test(String(id)) || !['en', 'fr'].includes(lang))
              throw new Error('bad id or language');
            if (path !== null && !/^\/[\w-]+\.(jpg|png)$/.test(path))
              throw new Error('bad poster path');
            const file = read();
            const entry = { ...file[id] };
            if (path) entry[lang] = path;
            else delete entry[lang];
            if (Object.keys(entry).length) file[id] = entry;
            else delete file[id];
            const { _, ...rest } = file;
            const sorted = Object.fromEntries(Object.entries(rest).sort((a, b) => a[0] - b[0]));
            fs.writeFileSync(FILE, JSON.stringify({ _, ...sorted }, null, 2) + '\n');
            send(200, picks());
          } catch (e) {
            send(400, { error: e.message });
          }
        });
      });
    }
  };
}

export default defineConfig({ plugins: [sveltekit(), posterPicks()] });
