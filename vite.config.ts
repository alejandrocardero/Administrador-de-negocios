import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'
  
  return {
    base: isElectron ? './' : '/',
    plugins: [inspectAttr(), react()],
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
    }
  }
})