import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DocumentEditor, DocumentEditorPool } from '../src/renderer/document-editor.ts';
import type { DocumentDraft, DocumentEdit, DocumentRequest, DocumentResponse } from '../src/shared/documents.ts';
function setup() {
  let draft: DocumentDraft | undefined, revision = 1, failed = false;
  let finish: (() => void) | undefined;
  const committed: DocumentEdit[] = [];
  const send = async (input: DocumentRequest): Promise<DocumentResponse> => {
    if (input.action === 'stage-edit') { draft = input.draft; return null; }
    if (input.action === 'commit-edit') {
      assert.equal(input.draft.edit.revision, revision); if (failed) throw Error('disk full');
      await new Promise<void>(resolve => { finish = resolve; }); committed.push(input.draft.edit); revision++; return { revision };
    }
    return null;
  };
  const editor = new DocumentEditor(send, async () => {});
  const initial: DocumentEdit = { action: 'edit', id: randomUUID(), revision: 1, name: '資料', reference: 'https://example.com/', kind: 'url', description: '' };
  editor.begin(initial);
  return { editor, initial, committed, draft: () => draft, fail: () => { failed = true; }, retry: () => { failed = false; }, finish: () => { assert.ok(finish); const current = finish; finish = undefined; current(); }, waiting: () => !!finish };
}
async function until(predicate: () => boolean) { for (let i = 0; i < 50 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 2)); assert.ok(predicate()); }
test('document autosave never overwrites newer input with an old reply and re-stages the latest revision', async () => {
  const { editor, initial, committed, finish, waiting } = setup();
  editor.change({ ...initial, name: '先の入力' }); const saving = editor.save(); await until(waiting);
  editor.change({ ...initial, name: '後の入力' }); finish(); await until(waiting); assert.equal((editor.getSnapshot()!.draft.edit as Extract<DocumentEdit, { action: 'edit' }>).name, '後の入力'); finish(); assert.ok(await saving); assert.equal(committed.length, 2); assert.equal(committed[1]!.revision, 2); assert.equal(editor.getSnapshot()!.dirty, false);
});
test('document composition and DB failure preserve a durable draft and retry only on a valid save', async () => {
  const { editor, initial, fail, retry, draft, finish, waiting } = setup();
  editor.change({ ...initial, name: '変換中' }, true); assert.equal(await editor.save(), false); assert.ok(draft());
  fail(); editor.change({ ...initial, name: '確定した資料' }); assert.equal(await editor.save(), false); assert.equal(editor.getSnapshot()!.safe, true); assert.equal(editor.getSnapshot()!.status, 'error');
  retry(); const saving = editor.save(); await until(waiting); finish(); assert.equal(await saving, true); assert.equal(editor.getSnapshot()!.dirty, false);
});
test('document draft write failure retains input and prevents claiming a safe exit', async () => {
  const editor = new DocumentEditor(async () => { throw Error('draft disk unavailable'); }, async () => {});
  const edit: DocumentEdit = { action: 'edit', id: randomUUID(), revision: 1, name: '失わない入力', reference: 'https://example.com/', kind: 'url', description: '' };
  editor.begin(edit); editor.change(edit); assert.deepEqual(await editor.flush(), { ready: false, draftsSafe: false });
  assert.equal((editor.getSnapshot()!.draft.edit as Extract<DocumentEdit, { action: 'edit' }>).name, '失わない入力');
});
test('inline memo buffers isolate related pages and retain one failed input while another saves', async () => {
  const drafts = new Map<string, DocumentDraft>(), saved = new Map<string, string>();
  let failedId = '';
  const pool = new DocumentEditorPool(async input => {
    if (input.action === 'stage-edit') { drafts.set(input.draft.token, input.draft); return null; }
    if (input.action === 'commit-edit') {
      const edit = input.draft.edit; assert.equal(edit.action, 'use'); if (edit.action !== 'use') throw Error();
      if (edit.context.id === failedId) throw Error('disk full');
      assert.ok(drafts.has(input.draft.token)); saved.set(edit.context.id, edit.memo); return { revision: edit.revision + 1 };
    }
    return null;
  }, async () => {});
  const id = randomUUID(), a: Extract<DocumentEdit, { action: 'use' }> = { action: 'use', id, context: {kind:'item',id:randomUUID()}, revision:1, memo:'ページAの用途\n改行も保持', group:'', position:1 };
  const b = { ...a, context:{kind:'item' as const,id:randomUUID()}, memo:'ページBの用途' };
  const ea = pool.get(a), eb = pool.get(b); ea.begin(a); eb.begin(b); ea.change(a); eb.change(b);
  failedId = a.context.id; assert.deepEqual(await pool.flush(), { ready:false, draftsSafe:true });
  assert.deepEqual(await pool.flush(edit=>edit.id!==a.id||edit.action==='use'&&edit.context.id===b.context.id),{ready:true,draftsSafe:true});
  assert.equal(pool.getSnapshot(edit=>edit.action==='use'&&edit.context.id===b.context.id),undefined);
  assert.equal(pool.getSnapshot(edit=>edit.action==='use'&&edit.context.id===a.context.id)!.status,'error');
  assert.equal(saved.get(b.context.id), b.memo); assert.equal(ea.getSnapshot()!.dirty, true); assert.equal(pool.getSnapshot()!.status,'error');
  failedId = ''; assert.deepEqual(await pool.flush(), {ready:true,draftsSafe:true}); assert.equal(saved.get(a.context.id),a.memo); assert.equal(pool.getSnapshot(),undefined);
});

