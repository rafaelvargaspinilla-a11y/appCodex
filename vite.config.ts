import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
    manifest: {
      name: 'Beast Log · Diario de entrenamiento', short_name: 'Beast Log',
      description: 'Entrenamientos y peso corporal, también sin conexión.',
      lang: 'es', start_url: '.', scope: '.', display: 'standalone',
      background_color: '#141713', theme_color: '#141713',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'], navigateFallback: `${base}index.html` }
  })],
  server: { port: 5173 },
  preview: { port: 4173 }
});
