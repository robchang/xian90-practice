import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

process.env.VITE_APP_VERSION = process.env.VITE_APP_VERSION || 'speak-r6'
process.env.VITE_APP_COMMIT = (process.env.VITE_APP_COMMIT || gitCommit()).slice(0, 7)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['*.mp3', '*.json'],
      manifest: {
        name: 'Xi\'an 90 Mandarin Practice',
        short_name: 'Xi\'an 90',
        description: 'Daily Mandarin practice for Xi\'an Incident commemoration speech',
        theme_color: '#8B0000',
        background_color: '#FFFEF0',
        display: 'standalone',
        start_url: '.',
        icons: [
          {
            src: './icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: './icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,json}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      }
    })
  ],
  base: process.env.BASE_PATH || './',
  optimizeDeps: {
    exclude: ['@huggingface/transformers']
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
})
