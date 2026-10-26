import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';
import { defineConfig } from 'vitest/config';

const BUILT_AT = new Date().toISOString();
const BUILD_ID = Date.now().toString(36);

/** Writes /version.json so a running copy of the app can tell when a newer version is online. */
function versionFile(): Plugin {
  return {
    name: 'speakly-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID, builtAt: BUILT_AT }) });
    },
  };
}

/**
 * Writes sw.js: caches the app shell so it opens offline and installs as a phone app.
 * Speech and AI calls always go to the network.
 */
function serviceWorker(): Plugin {
  return {
    name: 'speakly-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['/', ...Object.keys(bundle).filter((f) => f !== 'version.json').map((f) => `/${f}`), '/icon.svg', '/manifest.webmanifest'];
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `// Generated at build time.
const APP = 'speakly-app-${BUILD_ID}';
const PRECACHE = ${JSON.stringify([...new Set(files)])};
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('speakly-app-') && k !== APP).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/version.json') return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
`,
      });
    },
  };
}

/**
 * Runs the Vercel functions in api/ inside the Vite dev server, so `npm run dev` is the
 * whole app. Each api/<name>.ts exports GET/POST(request: Request) => Response.
 */
function devApi(): Plugin {
  let server: ViteDevServer;
  return {
    name: 'speakly-dev-api',
    apply: 'serve',
    configureServer(s) {
      server = s;
      Object.assign(process.env, loadEnv('development', process.cwd(), ''));
      s.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const match = /^\/api\/([a-z-]+)$/.exec(url.pathname);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`);
          const handler = mod[req.method ?? 'GET'];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(url, {
            method: req.method,
            headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          if (response.body) Readable.fromWeb(response.body as never).pipe(res);
          else res.end();
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end(String(err));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi(), versionFile(), serviceWorker()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILT_AT__: JSON.stringify(BUILT_AT),
  },
  server: { port: 5190, strictPort: true },
  preview: { port: 4190, strictPort: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
