import { mkdir, writeFile as nodeWriteFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export interface DownloadGeneratedVideoInput {
  taskId: string;
  videoUrl: string;
}

export interface DownloadService {
  downloadGeneratedVideo(input: DownloadGeneratedVideoInput): Promise<string>;
}

export interface CreateDownloadServiceOptions {
  homeDir?: string;
  now?: () => Date;
  fetchBytes?: (url: string) => Promise<Uint8Array>;
  writeFile?: (path: string, bytes: Uint8Array) => Promise<void>;
}

export function createDownloadService(options: CreateDownloadServiceOptions = {}): DownloadService {
  const getHomeDir = options.homeDir ?? homedir();
  const now = options.now ?? (() => new Date());
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const writeFile = options.writeFile ?? defaultWriteFile;

  return {
    async downloadGeneratedVideo(input) {
      const dateSegment = now().toISOString().slice(0, 10);
      const outputPath = path.join(
        getHomeDir,
        'Movies',
        'YQ',
        'exports',
        dateSegment,
        `${sanitizeFileName(input.taskId)}.mp4`
      );
      const bytes = await fetchBytes(input.videoUrl);
      await writeFile(outputPath, bytes);
      return outputPath;
    }
  };
}

async function defaultFetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('视频下载失败');
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function defaultWriteFile(outputPath: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await nodeWriteFile(outputPath, bytes);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}
