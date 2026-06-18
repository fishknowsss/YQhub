import { mkdir, writeFile as nodeWriteFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export interface DownloadGeneratedVideoInput {
  taskId: string;
  videoUrl: string;
  outputName?: string | null;
  prompt?: string | null;
}

export interface DownloadService {
  downloadGeneratedVideo(input: DownloadGeneratedVideoInput): Promise<string>;
}

export interface CreateDownloadServiceOptions {
  homeDir?: string;
  now?: () => Date;
  outputDirectory?: string | (() => string);
  fetchBytes?: (url: string) => Promise<Uint8Array>;
  writeFile?: (path: string, bytes: Uint8Array) => Promise<void>;
}

export function createDownloadService(options: CreateDownloadServiceOptions = {}): DownloadService {
  const getHomeDir = options.homeDir ?? homedir();
  const outputDirectory = options.outputDirectory;
  const now = options.now ?? (() => new Date());
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const writeFile = options.writeFile ?? defaultWriteFile;

  return {
    async downloadGeneratedVideo(input) {
      const currentDate = now();
      const dateSegment = currentDate.toISOString().slice(0, 10);
      const outputPath = path.join(
        resolveOutputDirectory(getHomeDir, outputDirectory),
        dateSegment,
        `${buildOutputFileBase(input, currentDate)}.mp4`
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

function resolveOutputDirectory(
  homeDir: string,
  outputDirectory: CreateDownloadServiceOptions['outputDirectory']
): string {
  if (typeof outputDirectory === 'function') {
    return outputDirectory();
  }

  if (outputDirectory) {
    return outputDirectory;
  }

  return path.join(homeDir, 'Downloads');
}

function buildOutputFileBase(input: DownloadGeneratedVideoInput, date: Date): string {
  const customName = sanitizeFileBase(input.outputName ?? '');

  if (customName) {
    return customName;
  }

  const promptName = sanitizeFileBase(input.prompt ?? '');
  const timestamp = formatUtcTimestamp(date);
  return promptName ? `YQhub-${timestamp}-${truncateFileBase(promptName, 42)}` : `YQhub-${timestamp}`;
}

function sanitizeFileBase(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/[\u0000-\u001f]+/g, '')
    .replace(/[，,、。；;：:！!？?（）()[\]{}]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '');
}

function truncateFileBase(value: string, maxLength: number): string {
  const characters = Array.from(value);

  if (characters.length <= maxLength) {
    return value;
  }

  return characters.slice(0, maxLength).join('').replace(/-+$/u, '');
}

function formatUtcTimestamp(date: Date): string {
  const value = Number.isNaN(date.getTime()) ? new Date(0) : date;
  const iso = value.toISOString();
  return `${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 16).replace(':', '')}`;
}
