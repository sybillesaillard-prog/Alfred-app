import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Hébergé sur GitHub Pages sous /alfred-app/ (dépôt sybillesaillard-prog/alfred-app),
// migration du 21/08/2026 depuis Netlify — cf. claude/app-alfred-notes.md.
const BASE_PATH = '/alfred-app/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Alfred',
        short_name: 'Alfred',
        description: 'Mon assistant personnel — dépenses et tâches',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Les fichiers du moteur OCR (worker/core wasm ~4 Mo) ne doivent pas
        // être forcés dans le pré-cache obligatoire de l'app — ils ne sont
        // utiles que lors d'une capture de ticket, pas à chaque ouverture.
        // Ils seront simplement chargés à la demande par le navigateur.
        globIgnores: ['**/tesseract/**'],
        // Le service worker intercepte toutes les requêtes de navigation et
        // les fait retomber sur l'app React (index.html) — ce qui écrasait
        // silencieusement les pages de prototype statiques comme
        // /prototype-ocr-drive/. On exclut explicitement ces chemins du
        // fallback de navigation.
        navigateFallbackDenylist: [/^\/prototype-/],
      },
    }),
  ],
})
