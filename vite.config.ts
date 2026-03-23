// vite.config.ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: '/fpv-blast/',
  plugins: [
    basicSsl(),
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // we provide our own manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [],       // API calls are network-only — no caching
        skipWaiting: true,        // activate new SW immediately, don't wait for tabs to close
        clientsClaim: true,       // take control of all open clients after activation
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true
  }
});
