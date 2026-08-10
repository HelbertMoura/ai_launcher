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
    // Vendor chunking (REF-006) — separa libs estáveis do bundle de aplicação.
    // Rolldown só aceita manualChunks como function (Vite 8 mudou do contract Rollup).
    // A função agrupa módulos por prefixo de pacote; cada chunk vira um arquivo separado,
    // melhorando cache de longo prazo no Tauri webview e isolando blast-radius de upgrades.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // Mantém em ordem: mais específico primeiro.
          if (id.includes('@phosphor-icons')) return 'icons';
          if (id.includes('@dnd-kit')) return 'dnd';
          if (id.includes('@tauri-apps')) return 'tauri';
          if (id.includes('i18next')) return 'i18n';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
        },
      },
    },
  },
});
