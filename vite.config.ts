import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  // __APP_VERSION__ lê do package.json pra nunca mais ter versão hardcoded.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Vite 8 usa oxc (rolldown) como minifier default — não precisa mais declarar 'esbuild'.
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
