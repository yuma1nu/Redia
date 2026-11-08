import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch } from './launch.mjs';
await mkdir('test-artifacts', { recursive: true });
const root = await mkdtemp(resolve('test-artifacts/phase3-'));
for (const stage of ['phase3-create', 'phase3-restart', 'phase3-crash', 'phase3-recover', 'phase3-close-restart', 'phase3-density', 'phase3-save-isolation', 'phase3-page-ui']) {
  await new Promise((resolveRun, reject) => {
    const child = launch(['--smoke-test', '--phase1-test'], { EW_TEST_DATA_DIR: root, EW_SCENARIO: stage, EW_DEV_URL: '' });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${stage} timed out`)); }, 60000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); if (code === (stage === 'phase3-crash' ? 17 : 0)) resolveRun(); else reject(new Error(`${stage} failed (${code})`)); });
  });
}
console.log(`PHASE3_ALL_PASSED ${root}`);
