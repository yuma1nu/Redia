import { win32 } from 'node:path';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { WorkspaceDatabase } from './db/workspace.ts';
import { DomainError, invalid, record, uuid } from '../shared/validation.ts';
import { documentDraftKey,documentUses } from '../shared/documents.ts';
import {validDocumentFilter} from '../shared/document-type.ts';
import type { DocumentDraft, DocumentBatch, DocumentContext, DocumentKind, DocumentRegistration, DocumentSnapshot, DocumentUse, DocumentView, WorkspaceDocument } from '../shared/documents.ts';

function string(value: unknown): string { if (typeof value !== 'string' || /[\x00-\x1f]/.test(value)) invalid('文字列に制御文字は使えません。'); return value; }
function prose(value: unknown): string { if (typeof value !== 'string' || value.includes('\0')) invalid(); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 1) invalid(); return value as number; }
function kind(value: unknown): DocumentKind { if (!['file', 'folder', 'url'].includes(value as string)) invalid(); return value as DocumentKind; }
function validateDocumentView(value: unknown): DocumentView {
  const v = record(value, ['query', 'kind', 'theme', 'sort', 'scroll', 'selected']);
  prose(v.query); if (!validDocumentFilter(v.kind) || !['name-asc','name-desc','updated-asc','updated-desc'].includes(v.sort as string)) invalid();
  if (v.theme !== 'all' && v.theme !== 'none') uuid(v.theme);
  if (v.selected !== '') uuid(v.selected);
  if (typeof v.scroll !== 'number' || !Number.isFinite(v.scroll) || v.scroll < 0) invalid();
  return v as DocumentView;
}
export function normalizeReference(raw: string, hint?: DocumentKind) {
  let reference = string(raw).trim().replace(/^"(.*)"$/, '$1');
  if (/^file:/i.test(reference)) { try { reference = fileURLToPath(reference, { windows: true }); } catch { invalid('ファイルURLを確認してください。'); } }
  if (/^https?:/i.test(reference)) {
    let url: URL; try { url = new URL(reference); } catch { invalid('URLを確認してください。'); }
    if (!url.hostname || url.username || url.password) invalid('認証情報を含まないHTTP/HTTPSのURLを入力してください。');
    return { reference: url.href, normalized: `url:${url.href}`, kind: 'url' as const, name: decodeURI(url.pathname.split('/').filter(Boolean).at(-1) || url.hostname) };
  }
  if (!/^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/.test(reference) || /[<>|?*]/.test(reference) || /:(?![\\/])/.test(reference.slice(2)) || /^\\\\[?.]\\/.test(reference)) invalid('絶対ファイルパス、共有パス、HTTP/HTTPSのURLを入力してください。');
  reference = win32.normalize(reference);
  if (reference.length > 3) reference = reference.replace(/[\\/]+$/, '');
  return { reference, normalized: `path:${reference.toLowerCase()}`, kind: hint === 'folder' ? 'folder' as const : 'file' as const, name: win32.basename(reference) || reference };
}
let activeProbes = 0;
async function infer(entry: DocumentRegistration) {
  const ref = normalizeReference(entry.reference, entry.kind);
  if(entry.name?.trim())ref.name=entry.name.trim();
  if (ref.kind !== 'url' && !entry.kind && !ref.reference.startsWith('\\\\') && activeProbes < 2) {
    // No network IO is required to register an offline reference. Timed-out stat never writes data.
    let timer: ReturnType<typeof setTimeout> | undefined;
    activeProbes++;
    const probe = stat(ref.reference).finally(() => { activeProbes--; });
    try { const info = await Promise.race([probe, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1200); })]); if (info) ref.kind = info.isDirectory() ? 'folder' : 'file'; }
    catch { if (/[\\/]$/.test(entry.reference)) ref.kind = 'folder'; }
    finally { clearTimeout(timer); }
  }
  if (ref.kind !== 'url' && !entry.kind && /[\\/]$/.test(entry.reference)) ref.kind = 'folder';
  return ref;
}
export class DocumentRepository {
  private workspace: WorkspaceDatabase;
  constructor(workspace: WorkspaceDatabase) { this.workspace = workspace; }
  snapshot(): DocumentSnapshot {
    const view = this.workspace.db.prepare('SELECT value FROM document_view WHERE id=1').get();
    const themeOrders:Record<string,string[]>={};
    for(const row of this.workspace.db.prepare('SELECT * FROM theme_document_order ORDER BY position,documentId').all())(themeOrders[String(row.themeId)]??=[]).push(String(row.documentId));
    return { documents: this.workspace.db.prepare('SELECT * FROM documents ORDER BY createdAt,id').all() as unknown as WorkspaceDocument[], uses: this.workspace.db.prepare('SELECT * FROM document_uses ORDER BY position,documentId').all() as unknown as DocumentUse[], themeOrders, ...(view ? { view: validateDocumentView(JSON.parse(String(view.value))) } : {}) };
  }
  get(id: string) { const found = this.snapshot().documents.find(doc => doc.id === id); if (!found) throw new DomainError('NOT_FOUND', '資料が見つかりません。'); return found; }
  context(raw: unknown): DocumentContext {
    const c = record(raw, ['kind', 'id']); if (c.kind !== 'item' && c.kind !== 'theme') invalid(); const id = uuid(c.id);
    if (c.kind === 'theme') { if (this.workspace.theme(id).archived) throw new DomainError('CONFLICT', 'テーマを復元してから資料を編集してください。'); }
    else { const item = this.workspace.item(id); if (item.archived || item.themeId && this.workspace.theme(item.themeId).archived) throw new DomainError('CONFLICT', 'ページを復元してから資料を編集してください。'); }
    return { kind: c.kind, id };
  }
  attach(id: string, context: DocumentContext) {
    this.get(id);
    this.workspace.db.prepare(`INSERT OR IGNORE INTO document_uses(documentId,kind,contextId,position) VALUES (?,?,?,(SELECT coalesce(max(position),0)+1 FROM document_uses WHERE kind=? AND contextId=?))`).run(id, context.kind, context.id, context.kind, context.id);
  }
  async request(raw: unknown): Promise<DocumentSnapshot | DocumentBatch | null> {
    if (!raw || typeof raw !== 'object') invalid();
    const action = (raw as { action?: unknown }).action;
    if (action === 'list') { record(raw, ['action']); return this.snapshot(); }
    if (action === 'view') { const r = record(raw, ['action', 'view']); this.workspace.db.prepare('INSERT INTO document_view VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(validateDocumentView(r.view))); return null; }
    if (action === 'register') {
      const r = record(raw, ['action', 'entries', 'context']);
      const context = r.context === null ? null : this.context(r.context);
      if (!Array.isArray(r.entries) || r.entries.length === 0 || r.entries.length > 1000) invalid('一度に1〜1000件を登録してください。');
      const entries = r.entries.map(entry => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(key => !['reference', 'kind','name'].includes(key))) invalid();
        if(entry.name!==undefined&&(typeof entry.name!=='string'||/[\x00-\x1f\x7f]/.test(entry.name)||[...entry.name].length>512))invalid('貼り付けた資料名を確認してください。');
        return { reference: prose(entry.reference), ...(entry.kind === undefined ? {} : { kind: kind(entry.kind) }),...(entry.name===undefined?{}:{name:entry.name}) };
      });
      const prepared = await Promise.all(entries.map(async entry => { try { return { entry, ref: await infer(entry) }; } catch (error) { return { entry, error: error instanceof Error ? error.message : '登録できませんでした。' }; } }));
      if (context) this.context(context);
      const result: DocumentBatch = { registered: [], reused: [], failed: [] };
      for (const p of prepared) {
        if (!p.ref) { result.failed.push({ ...p.entry, message: p.error! }); continue; }
        let began = false;
        try {
          this.workspace.db.exec('BEGIN IMMEDIATE'); began = true;
          const existing = this.snapshot().documents.find(doc => doc.normalized === p.ref.normalized);
          const id = existing?.id ?? randomUUID(), now = new Date().toISOString();
          if (!existing) this.workspace.db.prepare('INSERT INTO documents(id,name,reference,normalized,kind,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run(id, p.ref.name, p.ref.reference, p.ref.normalized, p.ref.kind, now, now);
          if (context) this.attach(id, context);
          this.workspace.db.exec('COMMIT'); result.registered.push(id);if(existing)result.reused.push(id);
        } catch { if (began) this.workspace.db.exec('ROLLBACK'); result.failed.push({ ...p.entry, message: '登録を保存できませんでした。再試行してください。' }); }
      }
      return result;
    }
    return this.mutate(raw);
  }
  applied(draft: DocumentDraft): number | undefined {
    const row = this.workspace.db.prepare('SELECT draftKey,revision FROM document_applied_edits WHERE token=?').get(draft.token);
    if (row && row.draftKey !== documentDraftKey(draft.edit)) throw new DomainError('CONFLICT', '資料の保存要求が一致しません。');
    return row ? Number(row.revision) : undefined;
  }
  commitEdit(draft: DocumentDraft): number {
    const applied = this.applied(draft); if (applied !== undefined) return applied;
    this.workspace.db.exec('BEGIN IMMEDIATE');
    try {
      this.mutate(draft.edit);
      const edit = draft.edit;
      const next = edit.action === 'edit' ? this.get(edit.id).revision : Number(this.workspace.db.prepare('SELECT revision FROM document_uses WHERE documentId=? AND kind=? AND contextId=?').get(edit.id, edit.context.kind, edit.context.id)!.revision);
      this.workspace.db.prepare('INSERT INTO document_applied_edits VALUES (?,?,?)').run(draft.token, documentDraftKey(edit), next);
      this.workspace.db.exec('COMMIT'); return next;
    } catch (error) { this.workspace.db.exec('ROLLBACK'); throw error; }
  }
  private mutate(raw: unknown): null {
    if (!raw || typeof raw !== 'object') invalid(); const action = (raw as { action?: unknown }).action;
    if (action === 'reorder') {
      const r = record(raw, ['action', 'context', 'ids', 'revisions']), context = this.context(r.context);
      if (!Array.isArray(r.ids) || !Array.isArray(r.revisions)) invalid();
      const ids = r.ids.map(uuid), revisions = r.revisions.map(revision);
      const related=documentUses(this.snapshot(),context,this.workspace.items());
      const uses=[...new Set(related.map(use=>use.documentId))].map(id=>related.find(use=>use.documentId===id&&use.kind===context.kind&&use.contextId===context.id)??related.find(use=>use.documentId===id)!);
      if (ids.length !== uses.length || revisions.length !== ids.length || new Set(ids).size !== ids.length || ids.some((id, i) => !uses.some(use => use.documentId === id && use.revision === revisions[i]))) throw new DomainError('CONFLICT', '関連資料が更新されています。再読み込みして並べ替えてください。');
      this.workspace.db.exec('BEGIN IMMEDIATE');
      try { if(context.kind==='theme'){this.workspace.db.prepare('DELETE FROM theme_document_order WHERE themeId=?').run(context.id);ids.forEach((id,index)=>this.workspace.db.prepare('INSERT INTO theme_document_order VALUES (?,?,?)').run(context.id,id,index));}else ids.forEach((id, index) => { this.workspace.db.prepare('UPDATE document_uses SET position=?,revision=revision+1 WHERE documentId=? AND kind=? AND contextId=?').run(index + 1, id, context.kind, context.id); }); this.workspace.db.exec('COMMIT'); }
      catch (error) { this.workspace.db.exec('ROLLBACK'); throw error; }
      return null;
    }
    if (action === 'attach') { const r = record(raw, ['action', 'id', 'context']); this.attach(uuid(r.id), this.context(r.context)); return null; }
    if (action === 'use' || action === 'detach') {
      const r = record(raw, action === 'use' ? ['action', 'id', 'context', 'revision', 'memo', 'group', 'position'] : ['action', 'id', 'context', 'revision']);
      const c = this.context(r.context), id = uuid(r.id), rev = revision(r.revision);
      if (action === 'use' && (typeof r.position !== 'number' || !Number.isFinite(r.position))) invalid();
      const change = action === 'use' ? this.workspace.db.prepare('UPDATE document_uses SET memo=?,"group"=?,position=?,revision=revision+1 WHERE documentId=? AND kind=? AND contextId=? AND revision=?').run(prose(r.memo), prose(r.group), r.position as number, id, c.kind, c.id, rev) : this.workspace.db.prepare('DELETE FROM document_uses WHERE documentId=? AND kind=? AND contextId=? AND revision=?').run(id, c.kind, c.id, rev);
      if (!change.changes) throw new DomainError('CONFLICT', '関連情報が変更されています。再読み込みして再試行してください。');
      return null;
    }
    if (action === 'edit' || action === 'remove') {
      const r = record(raw, action === 'edit' ? ['action', 'id', 'revision', 'name', 'reference', 'description', 'kind'] : ['action', 'id', 'revision', 'linkCount']);
      const id = uuid(r.id), rev = revision(r.revision); this.get(id);
      if (action === 'remove') {
        const count = this.snapshot().uses.filter(use => use.documentId === id).length;
        if (r.linkCount !== count) throw new DomainError('CONFLICT', `関連数が${count}件に変わりました。再読み込みして確認してください。`);
        const result = this.workspace.db.prepare('DELETE FROM documents WHERE id=? AND revision=?').run(id, rev);
        if (!result.changes) throw new DomainError('CONFLICT', '資料が変更されています。再読み込みしてください。');
      } else {
        const ref = normalizeReference(string(r.reference), kind(r.kind)); const name = prose(r.name).trim() || ref.name;
        if (this.snapshot().documents.some(doc => doc.id !== id && doc.normalized === ref.normalized)) throw new DomainError('CONFLICT', '同じ参照先の資料が既にあります。既存資料を関連付けてください。');
        const result = this.workspace.db.prepare('UPDATE documents SET name=?,reference=?,normalized=?,kind=?,description=?,revision=revision+1,updatedAt=? WHERE id=? AND revision=?').run(name, ref.reference, ref.normalized, ref.kind, prose(r.description), new Date().toISOString(), id, rev);
        if (!result.changes) throw new DomainError('CONFLICT', '資料が変更されています。入力を保持しています。');
      }
      return null;
    }
    invalid('未対応の資料操作です。');
  }
}
