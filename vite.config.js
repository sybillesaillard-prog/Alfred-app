import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Hébergé sur GitHub Pages sous /Alfred-app/ (dépôt sybillesaillard-prog/Alfred-app),
// migration du 21/08/2026 depuis Netlify — cf. claude/app-alfred-notes.md.
// Important : la casse doit correspondre EXACTEMENT au nom du dépôt GitHub
// ("Alfred-app", avec un A majuscule) — GitHub Pages sert les fichiers avec
// un chemin sensible à la casse, donc un base path en minuscules cassait le
// chargement de tous les assets (JS/CSS renvoyés en 503) malgré un build réussi.
const BASE_PATH = '/Alfred-app/';

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
        // Les fichiers du moteur OCR (worker/core wasm ~4 Mo), la
        // bibliothèque d'export XLS (exceljs, ~900 Ko, chargée à la demande
        // via import() uniquement au clic sur "Exporter en XLS") et la
        // bibliothèque de lecture PDF (pdfjs-dist, ~1,2 Mo avec son worker,
        // chargée à la demande uniquement à l'import d'un PDF, cf.
        // src/lib/ocr.js) ne doivent pas être forcés dans le pré-cache
        // obligatoire de l'app — ils ne sont utiles qu'à l'usage de ces
        // fonctionnalités précises, pas à chaque ouverture. Ils seront
        // simplement chargés à la demande.
        globIgnores: ['**/tesseract/**', '**/exceljs*', '**/pdf.worker*', '**/pdfjs*'],
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
