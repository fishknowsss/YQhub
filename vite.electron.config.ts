import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist-electron/electron',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: {
        main: path.resolve(__dirname, 'electron/main.ts'),
        preload: path.resolve(__dirname, 'electron/preload.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-store',
        'node:crypto',
        'node:path',
        'node:url'
      ],
      output: {
        entryFileNames: '[name].js'
      }
    }
  }
});
