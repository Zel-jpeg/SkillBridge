import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'skillbridge-dev-cache',
      apply: (_config, { command, isPreview }) => command === 'serve' && !isPreview,
      config(config) {
        // Parallel dev servers must not overwrite each other's optimized React chunks.
        return { cacheDir: config.cacheDir ?? `node_modules/.vite/dev-${config.server?.port ?? 5173}` }
      },
    },
    react(),
    tailwindcss(),
  ],
})
