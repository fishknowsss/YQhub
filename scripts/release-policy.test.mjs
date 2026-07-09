import { describe, expect, it } from 'vitest';
import { createReleaseCleanupPlan } from './release-policy.mjs';

describe('release cleanup policy', () => {
  it('keeps the current release and only the previous version backup', () => {
    const plan = createReleaseCleanupPlan({
      currentVersion: '1.0.0',
      entries: [
        { name: 'YQhub-v1.0.0', isDirectory: true },
        { name: 'YQhub-v0.4.13', isDirectory: true },
        { name: 'YQhub-v0.4.12', isDirectory: true },
        { name: 'YQhub-v0.3.0', isDirectory: true },
        { name: 'YQhub-1.0.0-arm64.dmg', isDirectory: false },
        { name: 'YQhub-1.0.0-arm64.dmg.blockmap', isDirectory: false },
        { name: 'YQhub-1.0.0-x64.exe', isDirectory: false },
        { name: 'YQhub-1.0.0-x64.exe.blockmap', isDirectory: false },
        { name: 'latest.yml', isDirectory: false },
        { name: 'latest-mac.yml', isDirectory: false },
        { name: 'builder-debug.yml', isDirectory: false },
        { name: 'mac-arm64', isDirectory: true },
        { name: 'win-unpacked', isDirectory: true },
        { name: '.DS_Store', isDirectory: false },
        { name: 'manual-note.txt', isDirectory: false }
      ]
    });

    expect(plan.keep).toEqual(['YQhub-v1.0.0', 'YQhub-v0.4.13', 'manual-note.txt']);
    expect(plan.remove).toEqual([
      'YQhub-v0.4.12',
      'YQhub-v0.3.0',
      'YQhub-1.0.0-arm64.dmg',
      'YQhub-1.0.0-arm64.dmg.blockmap',
      'YQhub-1.0.0-x64.exe',
      'YQhub-1.0.0-x64.exe.blockmap',
      'latest.yml',
      'latest-mac.yml',
      'builder-debug.yml',
      'mac-arm64',
      'win-unpacked',
      '.DS_Store'
    ]);
  });
});
