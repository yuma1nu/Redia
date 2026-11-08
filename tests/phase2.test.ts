import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { dateHints, defaultView, effectivelyArchived, localToday, matchesQuery, selectItems, somedayItems, sortItems } from '../src/shared/lists.ts';
import { STATES } from '../src/shared/model.ts';
import type { DraftInput, Item, ListView, Result, Theme, WorkspaceSnapshot } from '../src/shared/model.ts';
import { validateArchive, validateView, validateViewKey } from '../src/shared/validation.ts';
import { migrations, migrate } from '../src/main/db/migrations.ts';
import { WorkspaceService } from '../src/main/service.ts';
import { ViewStore } from '../src/renderer/view-store.ts';

const item = (patch: Partial<Item> = {}): Item => ({ id: randomUUID(), title: '検討', state: '未着手', themeId: null, summary: '', body: '', dueDate: null, reviewDate: null, revision: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', archived: false, ...patch });
const theme = (patch: Partial<Theme> = {}): Theme => ({ id: randomUUID(), name: 'テーマ', description: '', revision: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', archived: false, ...patch });
function result<T>(value: Result<unknown>): T { assert.equal(value.ok, true, JSON.stringify(value)); return (value as { ok: true; value: T }).value; }

test('HOME fixed population, AND filters and independently visible someday never mix completed/archived pages', () => {
  const a = theme(), b = theme({ archived: true });
  const rows = STATES.map(state => item({ state, title: '温度ＡＢＣ', summary: '装置の準備', body: '条件を測定', themeId: a.id }));
  rows.push(item({ archived: true }), item({ themeId: b.id }), item({ title: '温度ABC', summary: '装置の準備', body: '条件を測定' }));
  const view = defaultView();
  assert.equal(selectItems(rows, [a, b], { type: 'home' }, view).length, 4);
  assert.equal(somedayItems(rows, [a, b]).length, 1);
  assert.equal(selectItems(rows, [a, b], { type: 'home' }, { ...view, query: 'ＡｂＣ 測定', state: '待ち', theme: a.id }).length, 1);
  assert.equal(selectItems(rows, [a, b], { type: 'home' }, { ...view, theme: 'none' }).length, 1);
  assert.equal(selectItems(rows, [a, b], { type: 'home' }, { ...view, state: '完了', includeArchived: true }).length, 0);
  assert.equal(selectItems(rows, [a, b], { type: 'home' }, { ...view, query: '該当なし' }).length, 0);
  assert.equal(somedayItems(rows, [a, b])[0].state, 'いつか');
  assert.equal(matchesQuery(rows[0], '温度 準備 測定'), true);
  assert.equal(matchesQuery(rows[0], a.name), false);
  assert.equal(selectItems(rows, [a, b], { type: 'theme', id: a.id }, view).length, 4);
  assert.equal(selectItems(rows, [a, b], { type: 'theme', id: a.id }, { ...view, showClosed: true }).length, 6);
  assert.equal(selectItems(rows, [a, b], { type: 'search' }, view).length, 7);
  assert.equal(selectItems(rows, [a, b], { type: 'search' }, { ...view, includeArchived: true }).length, 9);
});

test('date sorting keeps nulls last in both directions, ties stable, and Japanese numeric titles ordered', () => {
  const missing = item({ title: '検討 3' }), early = item({ title: '検討 2', dueDate: '2026-01-01', reviewDate: '2026-01-01' }), late = item({ title: '検討 10', dueDate: '2026-12-31', reviewDate: '2026-12-31' });
  for (const sort of ['dueDate', 'reviewDate'] as const) {
    assert.deepEqual(sortItems([missing, late, early], { ...defaultView(), sort, direction: 'asc' }).map(x => x.id), [early.id, late.id, missing.id]);
    assert.deepEqual(sortItems([missing, late, early], { ...defaultView(), sort, direction: 'desc' }).map(x => x.id), [late.id, early.id, missing.id]);
  }
  assert.deepEqual(sortItems([late, early], { ...defaultView(), sort: 'title', direction: 'asc' }).map(x => x.id), [early.id, late.id]);
  const first = item({ id: '00000000-0000-4000-8000-000000000001' }), second = item({ id: '00000000-0000-4000-8000-000000000002' });
  for (const direction of ['asc', 'desc'] as const) assert.deepEqual(sortItems([second, first], { ...defaultView(), sort: 'dueDate', direction }).map(x => x.id), [first.id, second.id]);
  const future = item({ state: 'いつか', reviewDate: null }), due = item({ state: 'いつか', reviewDate: '2026-01-01' });
  assert.equal(somedayItems([future, due], [])[0].id, due.id);
});

test('date hints use the local calendar and never change states/dates; completed and archived stay quiet', () => {
  assert.equal(localToday(new Date(2026, 10, 3, 23, 59)), '2026-11-03');
  const t = theme({ archived: true });
  const current = item({ state: 'いつか', dueDate: '2026-11-02', reviewDate: '2026-11-03' });
  const before = structuredClone(current);
  assert.deepEqual(dateHints(current, [], '2026-11-03'), ['期限超過', '確認日到来']);
  assert.deepEqual(current, before);
  assert.deepEqual(dateHints({ ...current, dueDate: '2026-11-03', reviewDate: null }, [], '2026-11-03'), ['当日期限']);
  for (const patch of [{ state: '完了' as const }, { state: '中止' as const }, { archived: true }, { themeId: t.id }]) assert.deepEqual(dateHints({ ...current, ...patch }, [t], '2026-11-03'), []);
  assert.equal(effectivelyArchived({ ...current, themeId: t.id }, [t]), true);
});

test('view and archive input boundaries reject injected keys, invalid flags and unsupported properties', () => {
  assert.equal(validateViewKey(`theme:${randomUUID()}`).startsWith('theme:'), true);
  for (const key of ['__proto__', '../settings', 'theme:../../db']) assert.throws(() => validateViewKey(key));
  for (const patch of [{ sort: 'DROP TABLE items' }, { columns: ['priority'] }, { columns: ['dueDate', 'dueDate'] }, { scrollTop: Infinity }, { selectedId: '../id' }, { extra: 1 }]) assert.throws(() => validateView({ ...defaultView(), ...patch }));
  assert.throws(() => validateArchive({ kind: 'item', id: randomUUID(), archived: 'yes', baseRevision: 1 }));
  assert.throws(() => validateArchive({ kind: 'theme', id: '../theme', archived: true, baseRevision: 1 }));
});

test('v1 upgrades preserve records; view settings and independent archive flags survive restart without cascading changes', async () => {
  mkdirSync('test-artifacts', { recursive: true }); const root = mkdtempSync(resolve('test-artifacts/phase2-db-'));
  const paths = { database: join(root, 'workspace.sqlite'), drafts: join(root, 'drafts'), attachments: join(root, 'attachments'), backups: join(root, 'backups') };
  for (const path of [paths.drafts, paths.attachments, paths.backups]) mkdirSync(path);
  const v1 = new DatabaseSync(paths.database); migrate(v1, migrations.slice(0, 1));
  const oldThemeId = randomUUID(), oldItemId = randomUUID();
  v1.prepare('INSERT INTO themes(id,name,createdAt,updatedAt) VALUES (?,?,?,?)').run(oldThemeId, 'Phase 1で保存したテーマ', '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z');
  v1.prepare('INSERT INTO items(id,title,state,themeId,summary,body,dueDate,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)').run(oldItemId, 'Phase 1の記録', '完了', oldThemeId, '以前のサマリ', '以前の本文\n改行も保持', '2020-02-01', '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z');
  v1.close();
  let service = new WorkspaceService(paths);
  assert.equal(service.database.item(oldItemId).body, '以前の本文\n改行も保持');
  assert.equal(service.database.item(oldItemId).dueDate, '2020-02-01');
  const beforeMigration = new DatabaseSync(join(root, readdirSync(root).find(name => name.startsWith('workspace.sqlite.before-v2-'))!), { readOnly: true });
  assert.equal(beforeMigration.prepare('PRAGMA user_version').get()!.user_version, 1);
  assert.equal(beforeMigration.prepare('SELECT summary FROM items WHERE id=?').get(oldItemId)!.summary, '以前のサマリ'); beforeMigration.close();
  async function create(kind: 'new-theme' | 'new-item', fields: DraftInput['fields']) {
    const ref = { kind, id: randomUUID() }, token = randomUUID(); result(await service.request('stageDraft', { ref, token, baseRevision: 0, fields }));
    return result<{ item?: Item; theme?: Theme }>(await service.request('commitDraft', { ref, token }));
  }
  const parent = (await create('new-theme', { name: '残すテーマ' })).theme!;
  const original = (await create('new-item', { title: '元の項目', themeId: parent.id, originId: null })).item!;
  const derived = (await create('new-item', { title: '気づき', themeId: null, originId: original.id })).item!;
  const unrelated = (await create('new-item', { title: '無関係の項目', themeId: null, originId: null })).item!;
  result(await service.request('setArchived', { kind: 'item', id: derived.id, archived: true, baseRevision: derived.revision }));
  result(await service.request('setArchived', { kind: 'theme', id: parent.id, archived: true, baseRevision: parent.revision }));
  assert.equal(service.database.item(original.id).archived, false); assert.equal(service.database.item(original.id).revision, original.revision);
  assert.equal(service.database.item(derived.id).state, '未着手'); assert.equal(service.database.item(derived.id).archived, true);
  assert.equal(service.database.links().length, 1); assert.equal(service.database.item(unrelated.id).archived, false);
  const view: ListView = { ...defaultView(), query: '残す', theme: parent.id, sort: 'dueDate', direction: 'asc', columns: ['dueDate', 'reviewDate'], selectedId: original.id, scrollTop: 321, scrollLeft: 40, mainScrollTop: 18, somedayScrollTop: 65 };
  result(await service.request('saveListView', { key: 'home', view }));
  service.database.db.exec('PRAGMA query_only=ON');
  assert.equal((await service.request('setArchived', { kind: 'item', id: unrelated.id, archived: true, baseRevision: unrelated.revision })).ok, false);
  assert.equal(service.database.item(unrelated.id).archived, false);
  assert.equal((await service.request('saveListView', { key: 'home', view: { ...view, query: '失敗分' } })).ok, false);
  service.database.db.exec('PRAGMA query_only=OFF');
  await service.close(); service = new WorkspaceService(paths);
  const snapshot = result<WorkspaceSnapshot>(await service.request('getWorkspace', null));
  assert.deepEqual(snapshot.views.home, view); assert.equal(snapshot.items.length, 4);
  assert.equal(selectItems(snapshot.items, snapshot.themes, { type: 'home' }, defaultView()).length, 1);
  const restored = result<{ theme: Theme }>(await service.request('setArchived', { kind: 'theme', id: parent.id, archived: false, baseRevision: service.database.theme(parent.id).revision })).theme;
  assert.equal(restored.archived, false);
  assert.equal(service.database.item(original.id).state, '未着手'); assert.equal(service.database.item(derived.id).archived, true);
  assert.equal(service.database.links().length, 1);
  await service.close();
});

test('view settings coalesce safely, retain latest settings after failure, and retry successfully', async () => {
  let fail = true; const writes: ListView[] = [];
  const views = new ViewStore({ saveListView: async input => { if (fail) return { ok: false, error: { code: 'STORAGE_FAILED', message: 'read only' } }; writes.push(input.view); return { ok: true, value: null }; } });
  views.initialize({}); views.patch('home', { query: '保持する', columns: ['dueDate'] });
  assert.equal(await views.flush(), false); assert.equal(views.get('home').query, '保持する'); assert.ok(views.getSnapshot().errors.home);
  views.patch('home', { query: '最新の条件', scrollTop: 80 }); fail = false;
  assert.equal(await views.flush(), true); assert.equal(writes.at(-1)!.query, '最新の条件'); assert.equal(views.getSnapshot().errors.home, undefined);
  views.dispose();
});

test('a slow settings response cannot discard a newer filter or scroll position', async () => {
  let release!: () => void, started!: () => void, first = true;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  const writes: ListView[] = [];
  const views = new ViewStore({ saveListView: async input => {
    if (first) { first = false; started(); await new Promise<void>(resolve => { release = resolve; }); }
    writes.push(input.view); return { ok: true, value: null };
  } });
  views.initialize({}); views.patch('home', { query: '前の条件' });
  const flush = views.flush(); await waiting;
  views.patch('home', { query: '後の条件', scrollTop: 321 }); release();
  assert.equal(await flush, true); assert.deepEqual(writes.map(view => view.query), ['前の条件', '後の条件']);
  assert.equal(writes.at(-1)!.scrollTop, 321); views.dispose();
});
