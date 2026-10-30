import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import desktopShortcut from './scripts/desktop-shortcut-plugin.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), desktopShortcut()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.{js,jsx}'],
    restoreMocks: true,
    clearMocks: true,
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true, // Allow all hosts (like localhost.run)
    strictPort: false
  }
})
