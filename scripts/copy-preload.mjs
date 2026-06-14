import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('electron/preload.cjs');
const target = path.resolve('dist-electron/electron/preload.cjs');

await mkdir(path.dirname(target), { recursive: true });
await copyFile(source, target);
