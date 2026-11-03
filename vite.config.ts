import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const assetRoot = path.resolve('assets');

const assetHandler: Connect.NextHandleFunction = (req, res, next) => {
  const raw = (req.url ?? '/').split('?')[0] ?? '/';
  const urlPath = decodeURIComponent(raw);
  const trimmed = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  const file = path.resolve(assetRoot, `.${trimmed}`);
  const inside = file.startsWith(`${assetRoot}${path.sep}`);
  if (!inside || !existsSync(file) || statSync(file).isDirectory()) {
    next();
    return;
  }
  const ext = path.extname(file);
  const types: Record<string, string> = {
    '.glb': 'model/gltf-binary',
    '.json': 'application/json',
    '.png': 'image/png',
  };
  res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
};

function islandAssets(): Plugin {
  return {
    name: 'island-assets',
    configureServer(server) {
      server.middlewares.use('/assets', assetHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/assets', assetHandler);
    },
    closeBundle() {
      cpSync(assetRoot, path.resolve('dist/assets'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [islandAssets()],
  server: { host: '0.0.0.0', port: 47321, strictPort: true },
  preview: { host: '127.0.0.1', port: 47323, strictPort: true },
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
