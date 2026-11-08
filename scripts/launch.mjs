import { spawn } from 'node:child_process';
import electron from 'electron';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function launch(args = [], extraEnv = {}, packaged = false) {
  const env = { ...process.env, ...extraEnv };
  delete env.ELECTRON_RUN_AS_NODE;
  const executable = packaged ? resolve('release/win-unpacked/Redia.exe') : electron;
  return spawn(executable, packaged ? args : ['.', ...args], { env, stdio: 'inherit', windowsHide: true });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const child = launch();
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
