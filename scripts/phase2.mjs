import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch } from './launch.mjs';
await mkdir('test-artifacts', { recursive: true });
const root = await mkdtemp(resolve('test-artifacts/phase2-'));
for (const stage of ['phase2-create', 'phase2-restart', 'phase2-restore']) {
  await new Promise((resolveRun, reject) => {
    const child = launch(['--smoke-test', '--phase1-test'], { EW_TEST_DATA_DIR: root, EW_SCENARIO: stage, EW_DEV_URL: '' });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${stage} timed out`)); }, 60000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); if (code === 0) resolveRun(); else reject(new Error(`${stage} failed (${code})`)); });
  });
}
console.log(`PHASE2_ALL_PASSED ${root}`);
