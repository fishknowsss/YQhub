import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { createDownloadService } from './downloadService';

describe('download service', () => {
  it('downloads a generated video with a readable default file name', async () => {
    const writes: Array<{ path: string; bytes: Uint8Array }> = [];
    const expectedPath = path.join(
      '/Users/tester',
      'Downloads',
      'YQhub-20260613-0910-生成一条茶饮短片-产品在桌面旋转.mp4'
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
        videoUrl: 'https://cdn.example.com/result.mp4',
        prompt: '生成一条茶饮短片，产品在桌面旋转'
      })
    ).resolves.toBe(expectedPath);
    expect(writes).toEqual([
      {
        path: expectedPath,
        bytes: new Uint8Array([1, 2, 3])
      }
    ]);
  });

  it('uses the selected export directory when provided', async () => {
    const writes: Array<{ path: string; bytes: Uint8Array }> = [];
    const service = createDownloadService({
      outputDirectory: '/Volumes/Studio/YQhub',
      now: () => new Date('2026-06-13T09:10:00.000Z'),
      fetchBytes: async () => new Uint8Array([4, 5, 6]),
      writeFile: async (path, bytes) => {
        writes.push({ path, bytes });
      }
    });

    await expect(
      service.downloadGeneratedVideo({
        taskId: 'remote-task-9',
        videoUrl: 'https://cdn.example.com/vertical.mp4',
        outputName: '茶饮上市-竖版开场',
        prompt: '生成一条茶饮短片'
      })
    ).resolves.toBe(path.join('/Volumes/Studio/YQhub', '茶饮上市-竖版开场.mp4'));
    expect(writes[0]).toEqual({
      path: path.join('/Volumes/Studio/YQhub', '茶饮上市-竖版开场.mp4'),
      bytes: new Uint8Array([4, 5, 6])
    });
  });

  it('keeps existing files by adding a numeric suffix', async () => {
    const existingPath = path.join('/Volumes/Studio/YQhub', '茶饮上市-竖版开场.mp4');
    const writtenPaths = new Set([existingPath]);
    const writes: Array<{ path: string; bytes: Uint8Array }> = [];
    const service = createDownloadService({
      outputDirectory: '/Volumes/Studio/YQhub',
      now: () => new Date('2026-06-13T09:10:00.000Z'),
      fetchBytes: async () => new Uint8Array([4, 5, 6]),
      writeFile: async (path, bytes) => {
        if (writtenPaths.has(path)) {
          const error = new Error('already exists') as NodeJS.ErrnoException;
          error.code = 'EEXIST';
          throw error;
        }

        writtenPaths.add(path);
        writes.push({ path, bytes });
      }
    });

    await expect(
      service.downloadGeneratedVideo({
        taskId: 'remote-task-9',
        videoUrl: 'https://cdn.example.com/vertical.mp4',
        outputName: '茶饮上市-竖版开场',
        prompt: '生成一条茶饮短片'
      })
    ).resolves.toBe(path.join('/Volumes/Studio/YQhub', '茶饮上市-竖版开场-2.mp4'));
    expect(writes).toEqual([
      {
        path: path.join('/Volumes/Studio/YQhub', '茶饮上市-竖版开场-2.mp4'),
        bytes: new Uint8Array([4, 5, 6])
      }
    ]);
  });

  it('sanitizes empty or unsafe names before writing', async () => {
    const writes: Array<{ path: string; bytes: Uint8Array }> = [];
    const service = createDownloadService({
      homeDir: '/Users/tester',
      now: () => new Date('2026-06-13T09:10:00.000Z'),
      fetchBytes: async () => new Uint8Array([7, 8, 9]),
      writeFile: async (path, bytes) => {
        writes.push({ path, bytes });
      }
    });

    await expect(
      service.downloadGeneratedVideo({
        taskId: 'skill_x7%/broken',
        videoUrl: 'https://cdn.example.com/result.mp4',
        outputName: '  ../  ',
        prompt: ''
      })
    ).resolves.toBe(path.join('/Users/tester', 'Downloads', 'YQhub-20260613-0910.mp4'));
    expect(writes[0].path).not.toContain('skill_x7');
  });
});
