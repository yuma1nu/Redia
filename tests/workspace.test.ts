import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WorkspaceService } from '../src/main/service.ts';
import { WorkspaceDatabase } from '../src/main/db/workspace.ts';
import { migrate, migrations } from '../src/main/db/migrations.ts';
import { validateDraft, validateRef } from '../src/shared/validation.ts';
import { isSubmitKey, STATES } from '../src/shared/model.ts';
import type { DraftInput, DraftRef, Item, ItemFields, Result, Theme, WorkspaceSnapshot } from '../src/shared/model.ts';

function setup() {
  mkdirSync('test-artifacts', { recursive: true });
  const root = mkdtempSync(resolve('test-artifacts/db-'));
  const paths = { database: join(root, 'workspace.sqlite'), drafts: join(root, 'drafts'), attachments: join(root, 'attachments'), backups: join(root, 'backups') };
  for (const dir of [paths.drafts, paths.attachments, paths.backups]) mkdirSync(dir);
  return { root, paths, service: new WorkspaceService(paths) };
}
function value<T>(result: Result<unknown>): T { assert.equal(result.ok, true, JSON.stringify(result)); return (result as { ok: true; value: T }).value; }
async function commit(service: WorkspaceService, input: DraftInput) {
  value(await service.request('stageDraft', input));
  return service.request('commitDraft', { ref: input.ref, token: input.token });
}
function draft(kind: DraftRef['kind'], fields: DraftInput['fields'], id: string = randomUUID(), baseRevision = 0): DraftInput { return { ref: { kind, id }, fields, token: randomUUID(), baseRevision }; }
async function theme(service: WorkspaceService, name = '実験テーマ') { return value<{ theme: Theme }>(await commit(service, draft('new-theme', { name }))).theme; }
async function item(service: WorkspaceService, themeId: string | null = null, originId: string | null = null) { return value<{ item: Item }>(await commit(service, draft('new-item', { title: '温度特性の検討', themeId, originId }))).item; }
function fields(item: Item): ItemFields { const { title, summary, body, state, themeId, dueDate, reviewDate } = item; return { title, summary, body, state, themeId, dueDate, reviewDate }; }

test('Migration failure rolls back DDL and version; newer schemas and damaged DBs remain protected', () => {
  const db = new DatabaseSync(':memory:');
  assert.throws(() => migrate(db, [{ version: 1, sql: 'CREATE TABLE sample(id); INVALID SQL;' }]));
  assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 0);
  assert.equal(db.prepare("SELECT count(*) as n FROM sqlite_master WHERE name='sample'").get()!.n, 0);
  migrate(db); migrate(db);
  assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, migrations.length);
  db.exec('PRAGMA user_version=999'); assert.throws(() => migrate(db)); db.close();
  const { root, service } = setup(); service.database.close();
  const future = join(root, 'future.sqlite');
  const newer = new DatabaseSync(future); newer.exec('PRAGMA user_version=999; CREATE TABLE secret(value); INSERT INTO secret VALUES (42)'); newer.close();
  const before = readFileSync(future); assert.throws(() => new WorkspaceDatabase(future)); assert.deepEqual(readFileSync(future), before);
  const corrupt = join(root, 'broken.sqlite'); writeFileSync(corrupt, 'broken test DB');
  assert.throws(() => new WorkspaceDatabase(corrupt)); assert.equal(readFileSync(corrupt, 'utf8'), 'broken test DB');
  const existingPath = join(root, 'before-migration.sqlite');
  const existing = new DatabaseSync(existingPath); existing.exec('CREATE TABLE marker(value); INSERT INTO marker VALUES (7)'); existing.close();
  const upgraded = new WorkspaceDatabase(existingPath);
  assert.equal(upgraded.db.prepare('SELECT value FROM marker').get()!.value, 7); upgraded.close();
  const beforeUpgrade = readdirSync(root).find(name => name.startsWith('before-migration.sqlite.before-v1-'))!;
  const snapshot = new DatabaseSync(join(root, beforeUpgrade), { readOnly: true });
  assert.equal(snapshot.prepare('PRAGMA user_version').get()!.user_version, 0);
  assert.equal(snapshot.prepare('SELECT value FROM marker').get()!.value, 7); snapshot.close();
});

test('normal/related creation, one theme, bidirectional links, states, dates and summaries survive reopening', async () => {
  const { service, paths } = setup();
  const t = await theme(service, "研究 '); DROP TABLE items; --");
  const other = await theme(service, t.name); assert.notEqual(t.id, other.id);
  const unassigned = await item(service); assert.equal(unassigned.state, '未着手'); assert.equal(unassigned.themeId, null);
  const original = await item(service, t.id);
  const derived = await item(service, other.id, original.id);
  assert.equal(derived.state, '未着手'); assert.equal(derived.themeId, t.id);
  value(await service.request('addLink', { sourceId: unassigned.id, targetId: derived.id }));
  value(await service.request('addLink', { sourceId: derived.id, targetId: unassigned.id }));
  assert.equal(service.database.links().length, 2);
  let current = derived;
  for (const state of STATES) {
    current = value<{ item: Item }>(await commit(service, draft('item', { ...fields(current), state, summary: '装置が利用可能になったら再確認', body: '記録\n二行目', dueDate: '2028-02-29', reviewDate: '2027-01-01' }, current.id, current.revision))).item;
    assert.equal(current.summary, '装置が利用可能になったら再確認');
  }
  current = value<{ item: Item }>(await commit(service, draft('item', { ...fields(current), themeId: null, dueDate: null }, current.id, current.revision))).item;
  assert.equal(current.reviewDate, '2027-01-01'); assert.equal(service.database.links().length, 2);
  await service.close();
  const reopened = new WorkspaceService(paths);
  const saved = reopened.database.item(current.id);
  assert.equal(saved.dueDate, null); assert.equal(saved.themeId, null); assert.equal(saved.body, '記録\n二行目'); assert.equal(saved.state, 'いつか');
  assert.ok(reopened.database.links().some(link => link.sourceId === original.id && link.targetId === current.id));
  value(await reopened.request('removeLink', { sourceId: current.id, targetId: original.id }));
  assert.equal(reopened.database.items().length, 3);
  const overdue = value<{ item: Item }>(await commit(reopened, draft('item', { ...fields(saved), dueDate: '2000-01-01', reviewDate: '1999-01-01' }, saved.id, saved.revision))).item;
  const afterRead = value<WorkspaceSnapshot>(await reopened.request('getWorkspace', null)).items.find(item => item.id === saved.id)!;
  assert.equal(afterRead.state, overdue.state); assert.equal(afterRead.dueDate, '2000-01-01'); assert.equal(afterRead.reviewDate, '1999-01-01');
  const clearedReview = value<{ item: Item }>(await commit(reopened, draft('item', { ...fields(afterRead), reviewDate: null }, saved.id, afterRead.revision))).item;
  assert.equal(clearedReview.dueDate, '2000-01-01'); assert.equal(clearedReview.reviewDate, null);
  await reopened.close();
});

test('related-page creation is atomic, retryable and idempotent with an unstarted state and inherited theme', async () => {
  const { service } = setup();
  try {
    const t = await theme(service), origin = await item(service, t.id);
    const input = draft('new-item', { title: '関連して進めるページ', themeId: null, originId: origin.id });
    service.database.db.exec("CREATE TEMP TRIGGER fail_link BEFORE INSERT ON item_links BEGIN SELECT RAISE(ABORT,'test link failure'); END;");
    assert.equal((await commit(service, input)).ok, false);
    assert.equal(service.database.items().length, 1);
    assert.equal(service.database.links().length, 0);
    assert.equal(service.journal.list().length, 1);
    service.database.db.exec('DROP TRIGGER fail_link');
    const result = value<{ item: Item; link: { kind: string; sourceId: string; targetId: string } }>(await service.request('commitDraft', { ref: input.ref, token: input.token }));
    assert.equal(result.item.state, '未着手'); assert.equal(result.item.themeId, t.id);
    assert.equal(result.link.kind, 'related'); assert.equal(result.link.sourceId, origin.id);
    const retry = value<typeof result>(await service.request('commitDraft', { ref: input.ref, token: input.token }));
    assert.deepEqual(retry.item, result.item); assert.deepEqual({ ...retry.link }, result.link);
    assert.equal(service.database.items().length, 2); assert.equal(service.database.links().length, 1);
  } finally { await service.close(); }
});

test('runtime schemas reject extra properties, traversal, invalid dates/states and enforce summary without truncating drafts', async () => {
  assert.throws(() => validateRef({ kind: 'item', id: '../outside' }));
  assert.throws(() => validateRef({ kind: 'item', id: randomUUID(), path: 'outside' }));
  const { service } = setup(); const current = await item(service);
  for (const patch of [{ state: 'unknown' }, { dueDate: '2027-02-29' }, { reviewDate: '2028-13-01' }, { themeId: [] }, { priority: 1 }]) {
    assert.throws(() => validateDraft(draft('item', { ...fields(current), ...patch } as ItemFields, current.id, current.revision)));
  }
  const input = draft('item', { ...fields(current), title: '', summary: 'あ'.repeat(501) }, current.id, current.revision);
  assert.equal((await commit(service, input)).ok, false);
  assert.equal((service.journal.list()[0].fields as ItemFields).summary.length, 501);
  const valid = draft('item', { ...fields(current), summary: '😀'.repeat(500) }, current.id, current.revision);
  assert.equal((await commit(service, valid)).ok, true);
  assert.equal(isSubmitKey({ key: 'Enter', isComposing: true }), false);
  assert.equal(isSubmitKey({ key: 'Enter', isComposing: false, keyCode: 229 }), false);
  assert.equal(isSubmitKey({ key: 'Enter', isComposing: false }), true);
  assert.equal((await service.request('arbitrarySQL', 'DROP TABLE items')).ok, false);
  await service.close();
});

test('real SQLite write failure, revision conflict and stale tokens preserve drafts; retry is idempotent', async () => {
  const { service, paths } = setup(); const current = await item(service);
  const pending = draft('item', { ...fields(current), summary: '失敗しても残す' }, current.id, current.revision);
  value(await service.request('stageDraft', pending));
  service.database.db.exec('PRAGMA query_only=ON');
  const failed = await service.request('commitDraft', { ref: pending.ref, token: pending.token });
  assert.equal(failed.ok, false); assert.equal(service.journal.read(pending.ref)?.token, pending.token);
  assert.equal(service.database.item(current.id).summary, '');
  service.database.db.exec('PRAGMA query_only=OFF');
  const request = { ref: pending.ref, token: pending.token };
  const saved = value<{ item: Item }>(await service.request('commitDraft', request)).item;
  const retried = value<{ item: Item }>(await service.request('commitDraft', request)).item;
  assert.equal(saved.revision, retried.revision);
  const newer = draft('item', { ...fields(saved), summary: '最新の入力' }, current.id, saved.revision);
  value(await service.request('stageDraft', newer));
  assert.equal((await service.request('discardDraft', request)).ok, false);
  assert.equal(service.journal.read(newer.ref)?.token, newer.token);
  const conflict = { ...newer, baseRevision: 1 };
  const result = await commit(service, conflict); assert.equal(result.ok, false);
  await service.close();
  const reopened = new WorkspaceService(paths);
  const snapshot = value<WorkspaceSnapshot>(await reopened.request('getWorkspace', null));
  assert.equal(snapshot.drafts.length, 1); assert.equal((snapshot.drafts[0].fields as ItemFields).summary, '最新の入力');
  await reopened.close();
});

test('manual backup captures consistent DB, attachments and drafts with hashes and excludes external originals', async () => {
  const { service, root, paths } = setup(); const current = await item(service);
  const external = join(root, 'external-original.txt'); writeFileSync(external, 'DO NOT CHANGE');
  writeFileSync(join(paths.attachments, 'managed-fixture.bin'), Buffer.from([1, 2, 3, 4]));
  const pending = draft('item', { ...fields(current), title: '' }, current.id, current.revision);
  value(await service.request('stageDraft', pending));
  const backup = value<{ name: string }>(await service.request('createBackup', null));
  const dir = join(paths.backups, backup.name);
  assert.equal(readFileSync(external, 'utf8'), 'DO NOT CHANGE'); assert.equal(existsSync(join(dir, 'external-original.txt')), false);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  for (const file of manifest.files) assert.equal(createHash('sha256').update(readFileSync(join(dir, file.path))).digest('hex'), file.sha256);
  assert.ok(manifest.files.some((file: { path: string }) => file.path.startsWith('drafts/')));
  const restoredPath = join(root, 'restore-check.sqlite');
  copyFileSync(join(dir, 'workspace.sqlite'), restoredPath);
  const restored = new WorkspaceDatabase(restoredPath);
  assert.equal(restored.item(current.id).title, current.title); restored.close();
  const held = join(root, 'attachments-held');
  assert.equal(resolve(held).startsWith(resolve(root)), true);
  assert.equal(resolve(paths.attachments).startsWith(resolve(root)), true);
  renameSync(paths.attachments, held);
  assert.equal((await service.request('createBackup', null)).ok, false);
  assert.ok(readdirSync(paths.backups).some(name => name.endsWith('.partial')));
  for (const file of manifest.files) assert.equal(createHash('sha256').update(readFileSync(join(dir, file.path))).digest('hex'), file.sha256);
  assert.equal(readdirSync(paths.backups).filter(name => !name.endsWith('.partial')).length, 1);
  await service.close();
});
