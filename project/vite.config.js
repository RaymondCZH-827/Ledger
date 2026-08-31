import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // 👈 Allows Cloudflare / tunnel URLs
  },
  esbuild: {
    // 👈 Keep your esbuild settings here, but DO NOT put `jsx: ...` here
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
})