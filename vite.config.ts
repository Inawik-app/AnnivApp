import path from 'node:path';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vite';

const racine = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(racine, 'client'),
  plugins: [
    preact(),
    legacy({
      targets: ['chrome >= 38', 'safari >= 9'],
    }),
  ],
  build: {
    outDir: path.join(racine, 'dist'),
    emptyOutDir: true,
    cssTarget: 'chrome38',
    rollupOptions: {
      input: {
        main: path.join(racine, 'client', 'index.html'),
        tv: path.join(racine, 'client', 'tv', 'index.html'),
        joueur: path.join(racine, 'client', 'joueur', 'index.html'),
        hote: path.join(racine, 'client', 'hote', 'index.html'),
      },
    },
  },
});
