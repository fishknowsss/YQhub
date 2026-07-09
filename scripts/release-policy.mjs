import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const RELEASE_BUNDLE_PREFIX = 'YQhub-v';
const TRANSIENT_DIRECTORIES = new Set(['mac-arm64', 'win-unpacked']);
const TRANSIENT_FILES = new Set(['.DS_Store', 'builder-debug.yml', 'latest.yml', 'latest-mac.yml']);

export function createReleaseCleanupPlan({ currentVersion, entries }) {
  const currentBundleName = `${RELEASE_BUNDLE_PREFIX}${currentVersion}`;
  const previousBundleName = findPreviousBundleName(currentVersion, entries);
  const keptBundles = new Set([currentBundleName, previousBundleName].filter(Boolean));
  const keep = [];
  const remove = [];

  for (const entry of entries) {
    if (keptBundles.has(entry.name)) {
      keep.push(entry.name);
      continue;
    }

    if (isReleaseBundleName(entry.name) || isTransientReleaseEntry(entry)) {
      remove.push(entry.name);
      continue;
    }

    keep.push(entry.name);
  }

  return { keep, remove };
}

export async function cleanReleaseDirectory(releaseDir, currentVersion) {
  const entries = await readdir(releaseDir, { withFileTypes: true });
  const plan = createReleaseCleanupPlan({
    currentVersion,
    entries: entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }))
  });

  for (const name of plan.remove) {
    await rm(path.join(releaseDir, name), { force: true, recursive: true });
  }

  return plan;
}

function findPreviousBundleName(currentVersion, entries) {
  const current = parseSemver(currentVersion);

  if (!current) {
    return null;
  }

  return entries
    .filter((entry) => entry.isDirectory)
    .map((entry) => ({
      name: entry.name,
      version: parseReleaseBundleVersion(entry.name)
    }))
    .filter((entry) => entry.version && compareSemver(entry.version, current) < 0)
    .sort((left, right) => compareSemver(right.version, left.version))[0]?.name ?? null;
}

function isReleaseBundleName(name) {
  return Boolean(parseReleaseBundleVersion(name));
}

function parseReleaseBundleVersion(name) {
  if (!name.startsWith(RELEASE_BUNDLE_PREFIX)) {
    return null;
  }

  return parseSemver(name.slice(RELEASE_BUNDLE_PREFIX.length));
}

function parseSemver(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);

  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareSemver(left, right) {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

function isTransientReleaseEntry(entry) {
  if (entry.isDirectory) {
    return TRANSIENT_DIRECTORIES.has(entry.name);
  }

  return (
    TRANSIENT_FILES.has(entry.name) ||
    /^YQhub-\d+\.\d+\.\d+-.+\.(dmg|exe)$/.test(entry.name) ||
    /^YQhub-\d+\.\d+\.\d+-.+\.(dmg|exe)\.blockmap$/.test(entry.name)
  );
}
