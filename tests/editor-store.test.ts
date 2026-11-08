import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorStore } from '../src/renderer/editor-store.ts';
import type { EditorApi } from '../src/renderer/editor-store.ts';
import type { Commit, DraftInput, Item, ItemFields, Result } from '../src/shared/model.ts';

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const failed = <T>(): Result<T> => ({ ok: false, error: { code: 'STORAGE_FAILED', message: 'テスト用の保存障害' } });
function fixture() {
  let item: Item = { id: crypto.randomUUID(), title: '検討', state: '未着手', themeId: null, summary: '', body: '', dueDate: null, reviewDate: null, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archived: false };
  const ref = { kind: 'item' as const, id: item.id };
  let journal: DraftInput | undefined;
  let failStage = false, failCommit = false;
  let delayCommit: (() => Promise<void>) | undefined;
  const committed: string[] = [];
  const api = {
    getWorkspace: async () => ok({ items: [item], themes: [], links: [], drafts: [], views: {} }),
    stageDraft: async (draft: DraftInput) => { if (failStage) return failed<null>(); journal = structuredClone(draft); return ok(null); },
    commitDraft: async ({ token }: { token: string }) => {
      const staged = structuredClone(journal!);
      if (delayCommit) await delayCommit();
      if (failCommit) return failed<Commit>();
      assert.equal(token, staged.token);
      assert.equal(staged.baseRevision, item.revision);
      item = { ...item, ...staged.fields as ItemFields, revision: item.revision + 1 };
      committed.push(item.summary);
      return ok({ item });
    },
    discardDraft: async () => ok(null),
    addLink: async () => { throw new Error('Unexpected addLink in editor save test'); },
    removeLink: async () => ok(null),
  } satisfies EditorApi;
  const store = new EditorStore(api);
  return { store, ref, committed, item: () => item, journal: () => journal,
    stageFailure: (value: boolean) => { failStage = value; }, commitFailure: (value: boolean) => { failCommit = value; },
    delay: (value: () => Promise<void>) => { delayCommit = value; } };
}

test('late save response cannot overwrite new input; latest edit is re-staged against the new revision', async () => {
  const f = fixture(); await f.store.load();
  let release!: () => void, started!: () => void;
  const inFlight = new Promise<void>(resolve => { started = resolve; });
  let first = true;
  f.delay(async () => { if (first) { first = false; started(); await new Promise<void>(resolve => { release = resolve; }); } });
  f.store.edit(f.ref, { summary: '古い入力' });
  const save = f.store.save(f.ref); await inFlight;
  f.store.edit(f.ref, { summary: '新しい入力', body: '画面遷移後も保持' });
  assert.equal((f.store.buffer(f.ref).fields as ItemFields).summary, '新しい入力');
  release(); assert.equal(await save, true);
  assert.deepEqual(f.committed, ['古い入力', '新しい入力']);
  assert.equal(f.item().body, '画面遷移後も保持'); assert.equal(f.store.buffer(f.ref).dirty, false);
  f.store.dispose();
});

test('write failure preserves visible buffer and protected draft; retry saves the same input', async () => {
  const f = fixture(); await f.store.load(); f.commitFailure(true);
  f.store.edit(f.ref, { summary: '消さない入力' });
  assert.equal(await f.store.save(f.ref), false);
  assert.equal(f.store.buffer(f.ref).status, 'error'); assert.equal((f.journal()!.fields as ItemFields).summary, '消さない入力');
  assert.equal((f.store.buffer(f.ref).fields as ItemFields).summary, '消さない入力');
  assert.deepEqual(await f.store.flush(), { ready: false, draftsSafe: true });
  f.commitFailure(false); assert.equal(await f.store.save(f.ref), true); assert.equal(f.item().summary, '消さない入力');
  f.store.dispose();
});

test('an old failed response leaves the newer input intact and retry commits only that input', async () => {
  const f = fixture(); await f.store.load(); f.commitFailure(true);
  let release!: () => void, started!: () => void;
  const inFlight = new Promise<void>(resolve => { started = resolve; });
  let first = true;
  f.delay(async () => { if (first) { first = false; started(); await new Promise<void>(resolve => { release = resolve; }); } });
  f.store.edit(f.ref, { summary: '失敗する古い入力' });
  const save = f.store.save(f.ref); await inFlight;
  f.store.edit(f.ref, { summary: '失敗応答より新しい入力' });
  release(); assert.equal(await save, false);
  assert.equal((f.store.buffer(f.ref).fields as ItemFields).summary, '失敗応答より新しい入力');
  f.commitFailure(false); assert.equal(await f.store.save(f.ref), true);
  assert.deepEqual(f.committed, ['失敗応答より新しい入力']); f.store.dispose();
});

test('draft write failure blocks a safe exit; composition stages input without committing it', async () => {
  const f = fixture(); await f.store.load(); f.stageFailure(true);
  f.store.edit(f.ref, { body: '退避失敗の入力' });
  assert.deepEqual(await f.store.flush(), { ready: false, draftsSafe: false });
  assert.equal((f.store.buffer(f.ref).fields as ItemFields).body, '退避失敗の入力');
  f.stageFailure(false); f.store.edit(f.ref, { body: '変換中' }, true);
  assert.deepEqual(await f.store.flush(), { ready: false, draftsSafe: true }); assert.equal(f.committed.length, 0);
  f.store.edit(f.ref, { body: '変換済み\n改行' }); assert.equal(await f.store.save(f.ref), true);
  assert.equal(f.item().body, '変換済み\n改行'); f.store.dispose();
});
