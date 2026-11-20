import { defineConfig } from 'vite';

// Build straight into the repository root so GitHub Pages (root) serves the game.
// build tag shown on the title screen, so a cached old build is easy to spot on the device
const BUILD = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' KST';

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
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
