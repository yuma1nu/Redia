import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch } from './launch.mjs';
import { createServer } from 'vite';

await mkdir('test-artifacts', { recursive: true });
const root = await mkdtemp(resolve('test-artifacts', 'smoke-'));
const server = process.argv.includes('--dev') ? await createServer() : undefined;
await server?.listen();
try {
for (let run = 1; run <= 2; run++) {
  await new Promise((resolveRun, reject) => {
    const child = launch(['--smoke-test'], {
      EW_TEST_DATA_DIR: root,
      EW_DEV_URL: server ? 'http://127.0.0.1:5173' : '',
    }, process.argv.includes('--packaged'));
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Smoke timeout (30 seconds).')); }, 30000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(`Smoke run ${run} exited ${code}`));
      else { console.log(`Startup/shutdown run ${run} passed: ${root}`); resolveRun(); }
    });
  });
}
} finally {
  await server?.close();
}
