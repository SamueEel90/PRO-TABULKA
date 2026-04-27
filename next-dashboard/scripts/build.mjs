import { spawn } from 'node:child_process';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });

    child.on('error', reject);
  });
}

async function main() {
  const isVercelBuild = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
  const prismaGenerateScript = isVercelBuild ? 'prisma:generate:postgres' : 'prisma:generate:sqlite';

  await run('npm', ['run', 'legacy:sync']);
  await run('npm', ['run', prismaGenerateScript]);
  await run('next', ['build']);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});