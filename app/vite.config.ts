import { defineConfig } from 'vite';

// Build straight into the repository root so GitHub Pages (root) serves the game.
export default defineConfig({
  base: './',
  build: {
    outDir: '..',
    emptyOutDir: false,
    assetsDir: 'game',
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});
