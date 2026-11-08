import { createServer } from 'vite';
import { buildElectron } from './build.mjs';
import { launch } from './launch.mjs';

await buildElectron();
const server = await createServer();
await server.listen();
const child = launch([], { EW_DEV_URL: 'http://127.0.0.1:5173' });
const stop = async () => { child.kill(); await server.close(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('error', async error => { console.error(error); await stop(); process.exitCode = 1; });
child.on('exit', async code => { await server.close(); process.exitCode = code ?? 1; });
