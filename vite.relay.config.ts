import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist-relay',
    emptyOutDir: true,
    minify: false,
    ssr: true,
    target: 'node22',
    rollupOptions: {
      input: path.resolve(__dirname, 'relay/relayServer.ts'),
      external: [
        'node:http',
        'node:fs/promises',
        'node:crypto',
        'node:path',
        'node:url'
      ],
      output: {
        format: 'es',
        entryFileNames: 'relayServer.js'
      }
    }
  }
});
