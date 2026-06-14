import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(rootDir, 'release');
const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const bundleDir = path.join(releaseDir, `YQhub-v${version}`);

const artifactSpecs = [
  {
    source: `YQhub-${version}-arm64.dmg`,
    target: `YQhub-${version}-mac-arm64.dmg`,
    platform: 'macOS Apple Silicon'
  },
  {
    source: `YQhub-${version}-x64.exe`,
    target: `YQhub-${version}-windows-x64.exe`,
    platform: 'Windows x64'
  }
];

await rm(bundleDir, { force: true, recursive: true });
await mkdir(bundleDir, { recursive: true });

const copied = [];

for (const artifact of artifactSpecs) {
  const sourcePath = path.join(releaseDir, artifact.source);

  if (!(await exists(sourcePath))) {
    continue;
  }

  const targetPath = path.join(bundleDir, artifact.target);
  await copyFile(sourcePath, targetPath);

  const fileStat = await stat(targetPath);
  copied.push({
    ...artifact,
    bytes: fileStat.size,
    sha256: await sha256(targetPath)
  });
}

if (copied.length === 0) {
  throw new Error(`No YQhub ${version} installers found in ${releaseDir}`);
}

await writeFile(
  path.join(bundleDir, 'SHA256SUMS.txt'),
  copied.map((artifact) => `${artifact.sha256}  ${artifact.target}`).join('\n') + '\n',
  'utf8'
);

await writeFile(
  path.join(bundleDir, 'manifest.json'),
  `${JSON.stringify(
    {
      product: 'YQhub',
      version,
      createdAt: new Date().toISOString(),
      artifacts: copied.map(({ target, platform, bytes, sha256 }) => ({
        file: target,
        platform,
        bytes,
        sha256
      }))
    },
    null,
    2
  )}\n`,
  'utf8'
);

await writeFile(
  path.join(bundleDir, 'README.txt'),
  [
    `YQhub v${version}`,
    '',
    'Files in this folder are the final user-facing installers.',
    '',
    ...copied.map((artifact) => `- ${artifact.target}: ${artifact.platform}`),
    '',
    'macOS: open the DMG, drag YQhub into Applications, then launch YQhub.',
    'Windows: run the EXE installer.',
    '',
    'The app is unsigned. macOS or Windows may show an unverified developer warning.',
    'Use SHA256SUMS.txt if you need to verify the installer files.'
  ].join('\n') + '\n',
  'utf8'
);

const names = await readdir(bundleDir);
console.log(`Prepared release/YQhub-v${version}`);
for (const name of names.sort()) {
  console.log(`- ${name}`);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  hash.update(await readFile(filePath));
  return hash.digest('hex');
}
