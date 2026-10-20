/// <reference types="vitest/config" />
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type PluginOption } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'

  // PWA only for the web build (default / "web" mode). Electron loads local
  // files via file:// so a service worker would break asset loading and is
  // never useful there.
  const pwaPlugins: PluginOption[] = isElectron
    ? []
    : [
        VitePWA({
          registerType: 'autoUpdate',
          // Inject the registration script into index.html for web builds.
          // ('auto' would also pick it up, but being explicit documents intent.)
          injectRegister: 'auto',
          // Never run the SW in `vite dev`; keeps the dev server untouched.
          devOptions: { enabled: false },
          manifest: {
            name: 'AdminNegocio Pro',
            short_name: 'AdminNegocio',
            description:
              'Aplicación para la administración de negocios de venta de productos.',
            display: 'standalone',
            start_url: '.',
            scope: '.',
            theme_color: '#2563eb',
            background_color: '#0a0a0a',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            // Precache the app shell (JS/CSS/HTML + static assets).
            globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            // The plugin already precaches manifest icons; skip them in the
            // glob so they aren't listed twice in the precache manifest.
            globIgnores: ['**/pwa-192x192.png', '**/pwa-512x512.png'],
            // logo.png is ~2.3 MB, above Workbox's default 2 MiB limit.
            maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            // Serve index.html for in-app navigations when offline.
            navigateFallback: 'index.html',
            runtimeCaching: [
              {
                // Supabase API / auth / storage must NEVER be served from the
                // cache: offline data is handled by IndexedDB in later phases.
                urlPattern: /^https:\/\/[^/]*\.supabase\.(co|in)\/.*/i,
                handler: 'NetworkOnly',
              },
            ],
          },
        }),
      ]

  return {
    base: isElectron ? './' : '/',
    plugins: [inspectAttr(), react(), ...pwaPlugins],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: false,
      allowedHosts: true,
      cors: true,
      fs: {
        allow: ['..'],
      },
    },
    build: {
      outDir: isElectron ? 'dist-electron' : 'dist',
      emptyOutDir: true,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@supabase/supabase-js'],
    },
    define: {
      'import.meta.env.ELECTRON': isElectron,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
    },
  }
})
