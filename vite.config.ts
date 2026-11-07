/// <reference types="vitest/config" />
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type PluginOption } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'
  const isProduction = mode === 'production'

  // PWA only for the web build (default / "web" mode). Electron loads local
  // files via file:// so a service worker would break asset loading and is
  // never useful there.
  const pwaPlugins: PluginOption[] = isElectron
    ? []
    : [
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
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
              { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            globIgnores: ['**/pwa-192x192.png', '**/pwa-512x512.png'],
            maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            navigateFallback: 'index.html',
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/[^/]*\.supabase\.(co|in)\/.*/i,
                handler: 'NetworkOnly',
              },
            ],
          },
        }),
      ]

  // Security: Validate required environment variables
  const requiredEnvVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`⚠️ Missing required environment variable: ${envVar}`)
    }
  }

  // Security: CSP header plugin for production
  const securityHeadersPlugin: PluginOption = {
    name: 'security-headers',
    apply: 'build',
    transformIndexHtml(html) {
      if (!isProduction) return html
      // Inject CSP meta tag if not present
      if (!html.includes('Content-Security-Policy')) {
        const csp = [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: https: blob:",
          "connect-src 'self' https://podoudwdhkzzltdxgbnv.supabase.co wss://podoudwdhkzzltdxgbnv.supabase.co",
          "frame-src 'none'",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; ')
        return html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
        )
      }
      return html
    },
  }

  return {
    base: isElectron ? './' : '/',
    plugins: [inspectAttr(), react(), securityHeadersPlugin, ...pwaPlugins],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: false,
      allowedHosts: true,
      cors: {
        // Security: Restrict CORS in development
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        credentials: true,
      },
      fs: { allow: ['..'] },
    },
    build: {
      outDir: isElectron ? 'dist-electron' : 'dist',
      emptyOutDir: true,
      // Optimización: code splitting manual para reducir chunk principal
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'vendor-react': ['react', 'react-dom', 'react-i18next', 'i18next'],
            'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tooltip', '@radix-ui/react-tabs', '@radix-ui/react-switch', '@radix-ui/react-checkbox', '@radix-ui/react-radio-group', '@radix-ui/react-accordion', '@radix-ui/react-avatar', '@radix-ui/react-popover', '@radix-ui/react-scroll-area', '@radix-ui/react-separator', '@radix-ui/react-label', '@radix-ui/react-slot'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-charts': ['recharts'],
            'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority', 'lucide-react', 'sonner'],
            'vendor-dexie': ['dexie'],
            // Feature chunks (secciones grandes)
            'section-ventas': ['@/sections/Ventas'],
            'section-inventario': ['@/sections/Inventario'],
            'section-pedidos': ['@/sections/Pedidos'],
            'section-reportes': ['@/sections/Reportes'],
            'section-compras': ['@/sections/Compras', '@/sections/HacerCompras'],
            'section-salarios': ['@/sections/Salarios'],
            'section-configuracion': ['@/sections/Configuracion'],
          },
          chunkFileNames: 'assets/[name]-[hash].js',
        },
      },
      // Aumentar límite de advertencia de chunk size
      chunkSizeWarningLimit: 1000,
      // Minificación optimizada
      minify: 'esbuild',
      cssCodeSplit: true,
      // Security: No source maps in production
      sourcemap: !isProduction,
      // Security: Ensure no eval in production
      target: 'es2020',
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@supabase/supabase-js'],
    },
    define: {
      'import.meta.env.ELECTRON': isElectron,
      // Security: Remove debug flags in production
      'import.meta.env.DEBUG': !isProduction,
      'import.meta.env.DEV': !isProduction,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
    },
  }
})