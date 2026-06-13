import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { createDownloadService } from './downloadService';

describe('download service', () => {
  it('downloads a generated video into the local export path', async () => {
    const writes: Array<{ path: string; bytes: Uint8Array }> = [];
    const expectedPath = path.join(
      '/Users/tester',
      'Movies',
      'YQhub',
      'exports',
      '2026-06-13',
      'remote-task-1.mp4'
    );
    const service = createDownloadService({
      homeDir: '/Users/tester',
      now: () => new Date('2026-06-13T09:10:00.000Z'),
      fetchBytes: async (url) => {
        expect(url).toBe('https://cdn.example.com/result.mp4');
        return new Uint8Array([1, 2, 3]);
      },
      writeFile: async (path, bytes) => {
        writes.push({ path, bytes });
      }
    });

    await expect(
      service.downloadGeneratedVideo({
        taskId: 'remote-task-1',
        videoUrl: 'https://cdn.example.com/result.mp4'
      })
    ).resolves.toBe(expectedPath);
    expect(writes).toEqual([
      {
        path: expectedPath,
        bytes: new Uint8Array([1, 2, 3])
      }
    ]);
  });
});
