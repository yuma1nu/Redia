import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch } from './launch.mjs';

await mkdir('test-artifacts', { recursive: true });
const root = await mkdtemp(resolve('test-artifacts/phase1-'));
for (const stage of ['create', 'restart', 'crash', 'recover']) {
  await new Promise((resolveRun, reject) => {
    const child = launch(['--smoke-test', '--phase1-test'], { EW_TEST_DATA_DIR: root, EW_SCENARIO: stage, EW_DEV_URL: '' });
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Phase 1 ${stage} timed out`)); }, 45000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); if (code === (stage === 'crash' ? 17 : 0)) resolveRun(); else reject(new Error(`Phase 1 ${stage} failed (${code})`)); });
  });
}
console.log(`PHASE1_ALL_PASSED ${root}`);
console.log(await readFile(resolve(root, 'logs/app.log'), 'utf8'));
