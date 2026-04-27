import { access, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const workspaceRoot = path.resolve(projectRoot, '..');
const internalAssetsDir = path.join(projectRoot, 'legacy-assets');
const assetFiles = ['Index.html', 'dashboardSharedHelpers.html', 'sharedStyles.html'];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(internalAssetsDir, { recursive: true });

  let copiedCount = 0;
  for (const fileName of assetFiles) {
    const sourcePath = path.join(workspaceRoot, fileName);
    const targetPath = path.join(internalAssetsDir, fileName);
    if (!(await fileExists(sourcePath))) {
      continue;
    }
    await copyFile(sourcePath, targetPath);
    copiedCount += 1;
  }

  if (copiedCount) {
    console.log(`Synced ${copiedCount} legacy asset(s) into next-dashboard/legacy-assets.`);
    return;
  }

  console.log('No external legacy assets found. Keeping checked-in legacy-assets copies.');
}

main().catch((error) => {
  console.error('Legacy asset sync failed:', error);
  process.exitCode = 1;
});
