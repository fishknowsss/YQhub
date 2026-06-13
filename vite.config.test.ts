import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import config from './vite.config';

describe('packaged renderer build config', () => {
  it('uses relative asset paths for file-based Electron windows', async () => {
    expect(config).toMatchObject({
      base: './'
    });

    const html = await readFile(path.join(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('href="./icon.svg"');
    expect(html).not.toContain('href="/');
  });
});
