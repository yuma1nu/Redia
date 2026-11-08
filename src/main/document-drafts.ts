import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { documentDraftKey } from '../shared/documents.ts';
import type { DocumentDraft, DocumentEdit } from '../shared/documents.ts';
import { invalid, record, uuid } from '../shared/validation.ts';

export function validateDocumentDraft(raw: unknown): DocumentDraft {
  const d = record(raw, ['token', 'edit']);
  if (!d.edit || typeof d.edit !== 'object') invalid();
  const action = (d.edit as { action?: unknown }).action;
  if (action !== 'edit' && action !== 'use') invalid();
  const edit = record(d.edit, action === 'edit' ? ['action', 'id', 'revision', 'name', 'reference', 'description', 'kind'] : ['action', 'id', 'context', 'revision', 'memo', 'group', 'position']);
  uuid(edit.id); if (!Number.isSafeInteger(edit.revision) || (edit.revision as number) < 1) invalid();
  const text = (v: unknown) => { if (typeof v !== 'string' || v.includes('\0')) invalid(); };
  if (action === 'edit') { text(edit.name); text(edit.reference); text(edit.description); if (!['file','folder','url'].includes(edit.kind as string)) invalid(); }
  else { const c = record(edit.context, ['kind', 'id']); if (c.kind !== 'item' && c.kind !== 'theme') invalid(); uuid(c.id); text(edit.memo); text(edit.group); if (typeof edit.position !== 'number' || !Number.isFinite(edit.position)) invalid(); }
  return { token: uuid(d.token), edit: edit as DocumentEdit };
}
export class DocumentDraftJournal {
  private directory: string;
  constructor(directory: string) { this.directory = directory; mkdirSync(directory, { recursive: true }); }
  private path(draft: DocumentDraft) { return join(this.directory, `${documentDraftKey(draft.edit)}.json`); }
  stage(raw: unknown) { const draft = validateDocumentDraft(raw), path = this.path(draft); writeFileSync(`${path}.pending`, JSON.stringify(draft), { encoding: 'utf8', flush: true }); renameSync(`${path}.pending`, path); }
  read(draft: DocumentDraft): DocumentDraft | undefined { const path = this.path(draft); return existsSync(path) ? validateDocumentDraft(JSON.parse(readFileSync(path, 'utf8'))) : undefined; }
  list() { return readdirSync(this.directory).filter(name => name.endsWith('.json')).map(name => validateDocumentDraft(JSON.parse(readFileSync(join(this.directory, name), 'utf8')))); }
  clear(draft: DocumentDraft) { if (this.read(draft)?.token === draft.token) unlinkSync(this.path(draft)); }
}
