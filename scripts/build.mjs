import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function buildElectron() {
  await build({ entryPoints: ['src/main/index.ts'], outfile: 'dist-electron/main.cjs', bundle: true,
    platform: 'node', format: 'cjs', target: 'node24', external: ['electron'] });
  await build({ entryPoints: ['src/preload/index.ts'], outfile: 'dist-electron/preload.cjs', bundle: true,
    platform: 'node', format: 'cjs', target: 'node24', external: ['electron'] });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildElectron();
  await viteBuild();
}
