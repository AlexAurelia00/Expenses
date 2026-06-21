import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const frontendDir = path.resolve(process.cwd(), '..', 'frontend');
const outDir = path.resolve(process.cwd(), 'public');

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    const p = exec(cmd, { cwd, env: process.env }, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
    p.stdout?.pipe(process.stdout);
    p.stderr?.pipe(process.stderr);
  });
}

async function rimraf(p) {
  try {
    await fs.rm(p, { recursive: true, force: true });
  } catch (e) {
    // ignore
  }
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  console.log('Building frontend in', frontendDir);
  try {
    // install dependencies (quiet)
    await run('npm ci --silent --no-audit --no-fund', frontendDir);
  } catch (e) {
    console.warn('npm ci failed or already installed, continuing');
  }

  await run('npm run build', frontendDir);

  const distDir = path.join(frontendDir, 'dist');
  const exists = await fs.stat(distDir).then(() => true).catch(() => false);
  if (!exists) {
    console.error('Frontend dist not found at', distDir);
    process.exit(1);
  }

  // Remove old public and copy new build
  await rimraf(outDir);
  await copyDir(distDir, outDir);
  console.log('Frontend build copied to', outDir);
}

main().catch(err => {
  console.error('Failed to build frontend', err);
  process.exit(1);
});
