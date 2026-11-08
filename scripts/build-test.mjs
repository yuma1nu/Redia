import { build } from 'esbuild';
await build({ entryPoints: ['tests/electron-scenarios.ts'], outfile: 'dist-electron/phase1-scenarios.cjs', bundle: true,
  platform: 'node', format: 'cjs', target: 'node24', external: ['electron'] });
