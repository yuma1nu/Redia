import { backup, DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function files(directory: string, prefix = ''): string[] {
  return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error('アプリ管理領域のリンクはバックアップできません。');
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? files(directory, path) : [path];
  });
}
export async function createBackup(db: DatabaseSync, paths: { backups: string; attachments: string; drafts: string }) {
  const createdAt = new Date().toISOString();
  const name = `${createdAt.replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const pending = join(paths.backups, `${name}.partial`);
  mkdirSync(pending, { recursive: true });
  await backup(db, join(pending, 'workspace.sqlite'));
  for (const part of ['attachments', 'drafts'] as const) {
    mkdirSync(join(pending, part));
    for (const path of files(paths[part])) {
      const destination = join(pending, part, path);
      mkdirSync(join(destination, '..'), { recursive: true });
      copyFileSync(join(paths[part], path), destination);
    }
  }
  const check = new DatabaseSync(join(pending, 'workspace.sqlite'));
  try { check.exec('PRAGMA journal_mode=DELETE');if (check.prepare('PRAGMA integrity_check').get()!.integrity_check !== 'ok') throw new Error('バックアップDBの確認に失敗しました。'); }
  finally { check.close(); }
  const manifest = { version: 1, createdAt, files: files(pending).map(path => ({ path, sha256: createHash('sha256').update(readFileSync(join(pending, path))).digest('hex') })) };
  writeFileSync(join(pending, 'manifest.json'), JSON.stringify(manifest, null, 2), { flush: true });
  renameSync(pending, join(paths.backups, name));
  return { name, createdAt };
}
