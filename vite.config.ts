import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { createLocalD1Database } from './worker/local-d1.mjs';

function createLocalR2Bucket(storageDir: string) {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  return {
    async put(key: string, value: ArrayBuffer | Buffer | string, options?: any) {
      const safeKey = key.replace(/\//g, '_');
      const filePath = path.join(storageDir, safeKey);
      const metaPath = `${filePath}.meta.json`;
      const buf = value instanceof ArrayBuffer ? Buffer.from(value) : Buffer.isBuffer(value) ? value : Buffer.from(String(value));
      fs.writeFileSync(filePath, buf);
      fs.writeFileSync(metaPath, JSON.stringify(options || {}));
      return { key };
    },
    async get(key: string) {
      const safeKey = key.replace(/\//g, '_');
      const filePath = path.join(storageDir, safeKey);
      const metaPath = `${filePath}.meta.json`;
      if (!fs.existsSync(filePath)) return null;
      const buf = fs.readFileSync(filePath);
      const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
      return {
        body: buf,
        httpEtag: `"${buf.length}"`,
        writeHttpMetadata(headers: Headers) {
          if (meta?.httpMetadata?.contentType) {
            headers.set('Content-Type', meta.httpMetadata.contentType);
          }
        },
      };
    },
    async delete(key: string) {
      const safeKey = key.replace(/\//g, '_');
      const filePath = path.join(storageDir, safeKey);
      const metaPath = `${filePath}.meta.json`;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    },
  };
}

// Custom Vite plugin to serve the Hono Cloudflare API directly in Vite dev!
function cloudflareWorkerDevPlugin() {
  let appInstance: any = null;
  let localDbInstance: any = null;
  let localR2Instance: any = null;

  return {
    name: 'cloudflare-worker-dev',
    async configureServer(server: any) {
      // Create local D1 database file in .local-db.sqlite or in-memory
      const dbPath = path.resolve(process.cwd(), '.local-d1.sqlite');
      const { d1 } = createLocalD1Database(dbPath);
      localDbInstance = d1;
      localR2Instance = createLocalR2Bucket(path.resolve(process.cwd(), '.wrangler/local-r2'));

      // Import the compiled worker app
      const workerModule = await import('./worker/index');
      appInstance = workerModule.default;

      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url.startsWith('/api')) {
          return next();
        }

        try {
          // Construct Web Request
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host || 'localhost:5173';
          const fullUrl = `${protocol}://${host}${req.url}`;

          const headers = new Headers();
          for (const [key, val] of Object.entries(req.headers)) {
            if (val) headers.set(key, Array.isArray(val) ? val.join(', ') : (val as string));
          }

          let body: any = null;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            body = Buffer.concat(chunks);
          }

          const webRequest = new Request(fullUrl, {
            method: req.method,
            headers,
            body,
          });

          const env = {
            DB: localDbInstance,
            ATTACHMENTS_BUCKET: localR2Instance,
            JWT_SECRET: 'daily-office-manager-secure-jwt-secret-key-2025',
            DEFAULT_TIMEZONE: 'Africa/Cairo',
          };

          const executionCtx = {
            waitUntil: (promise: Promise<any>) => promise.catch(console.error),
            passThroughOnException: () => {},
          };

          const response = await appInstance.fetch(webRequest, env, executionCtx);

          res.statusCode = response.status;
          response.headers.forEach((val: string, key: string) => {
            res.setHeader(key, val);
          });

          const responseBuffer = await response.arrayBuffer();
          res.end(Buffer.from(responseBuffer));
        } catch (err: any) {
          console.error('[API Middleware Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), cloudflareWorkerDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
