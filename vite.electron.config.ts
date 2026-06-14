import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist-electron/electron',
    emptyOutDir: true,
    minify: false,
    ssr: true,
    target: 'node22',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'electron/main.ts')
      },
      external: [
        'electron',
        'electron-store',
        'node:fs/promises',
        'node:crypto',
        'node:os',
        'node:path',
        'node:url'
      ],
      output: {
        format: 'es',
        entryFileNames: '[name].js'
      }
    }
  }
});
