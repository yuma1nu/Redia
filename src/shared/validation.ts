import { OPTIONAL_COLUMNS, STATES } from './model.ts';
import { bodyText, parseBody } from './body.ts';
import type { ArchiveInput, ListView } from './model.ts';
import type { DraftInput, DraftRef, ItemFields, NewItemFields, ThemeFields } from './model.ts';

export class DomainError extends Error {
  code: 'INVALID_INPUT' | 'CONFLICT' | 'NOT_FOUND';
  constructor(code: 'INVALID_INPUT' | 'CONFLICT' | 'NOT_FOUND', message: string) { super(message); this.code = code; }
}
export function invalid(message = '入力内容を確認してください。'): never { throw new DomainError('INVALID_INPUT', message); }
export function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) invalid();
  return value;
}
function text(value: unknown): string { if (typeof value !== 'string' || value.includes('\0')) invalid(); return value; }
function nullableId(value: unknown) { return value === null ? null : uuid(value); }
function date(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('日付を確認してください。');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < '0001-01-01') invalid('存在する日付を入力してください。');
  return value;
}
export function validateRef(value: unknown): DraftRef {
  const ref = record(value, ['kind', 'id']);
  if (!['item', 'theme', 'new-item', 'new-theme'].includes(ref.kind as string)) invalid();
  return { kind: ref.kind as DraftRef['kind'], id: uuid(ref.id) };
}
export function validateDraft(value: unknown, commit = false): DraftInput {
  const input = record(value, ['ref', 'token', 'baseRevision', 'fields']);
  const ref = validateRef(input.ref);
  if (!Number.isSafeInteger(input.baseRevision) || (input.baseRevision as number) < 0) invalid();
  const token = uuid(input.token);
  let fields: DraftInput['fields'];
  if (ref.kind === 'item') {
    const hasBody = !!input.fields && typeof input.fields==='object' && Object.hasOwn(input.fields,'bodyJson');
    const f = record(input.fields, ['title', 'state', 'themeId', 'summary', 'body', 'dueDate', 'reviewDate', ...(hasBody?['bodyJson']:[])]);
    if (!STATES.includes(f.state as ItemFields['state'])) invalid();
    fields = { title: text(f.title), state: f.state as ItemFields['state'], themeId: nullableId(f.themeId),
      summary: text(f.summary), body: text(f.body), dueDate: date(f.dueDate), reviewDate: date(f.reviewDate) };
    if (hasBody) {
      if (f.bodyJson === null) (fields as ItemFields).bodyJson=null;
      else try { const json=text(f.bodyJson); const doc=parseBody(json); (fields as ItemFields).bodyJson=json; (fields as ItemFields).body=bodyText(doc); }
      catch(error) { invalid(error instanceof Error&&!(error instanceof SyntaxError)?error.message:'本文の形式を確認してください。入力は保持しています。'); }
    }
    if (commit && !(fields as ItemFields).title.trim()) invalid('タイトルを入力してください。');
    if (commit && [...(fields as ItemFields).summary].length > 500) invalid('サマリは500文字以内で入力してください。入力は下書きに保持されています。');
  } else if (ref.kind === 'new-item') {
    const f = record(input.fields, ['title', 'themeId', 'originId']);
    fields = { title: text(f.title), themeId: nullableId(f.themeId), originId: nullableId(f.originId) } satisfies NewItemFields;
    if (commit && !fields.title.trim()) invalid('タイトルを入力してください。');
  } else {
    const f = record(input.fields, ref.kind === 'theme' ? ['name', 'description'] : ['name']);
    fields = ref.kind === 'theme' ? { name: text(f.name), description: text(f.description) } satisfies ThemeFields : { name: text(f.name) };
    if (commit && !fields.name.trim()) invalid('テーマ名を入力してください。');
  }
  return { ref, token, baseRevision: input.baseRevision as number, fields };
}
export function validateDraftAction(value: unknown) {
  const input = record(value, ['ref', 'token']);
  return { ref: validateRef(input.ref), token: uuid(input.token) };
}
export function validateLink(value: unknown) {
  const f = record(value, ['sourceId', 'targetId']);
  const sourceId = uuid(f.sourceId), targetId = uuid(f.targetId);
  if (sourceId === targetId) invalid('同じページ同士は関連付けられません。');
  return { sourceId, targetId };
}
export function validateArchive(value: unknown): ArchiveInput {
  const input = record(value, ['kind', 'id', 'archived', 'baseRevision']);
  if (!['item', 'theme'].includes(input.kind as string) || typeof input.archived !== 'boolean' || !Number.isSafeInteger(input.baseRevision) || (input.baseRevision as number) < 1) invalid();
  return { kind: input.kind as ArchiveInput['kind'], id: uuid(input.id), archived: input.archived, baseRevision: input.baseRevision as number };
}
export function validateViewKey(value: unknown): string {
  if (value === 'home' || value === 'search' || value === 'archive') return value;
  if (typeof value !== 'string' || !value.startsWith('theme:')) invalid();
  return `theme:${uuid(value.slice(6))}`;
}
export function validateView(value: unknown): ListView {
  const v = record(value, ['query', 'state', 'theme', 'sort', 'direction', 'columns', 'showClosed', 'includeArchived', 'scrollTop', 'scrollLeft', 'mainScrollTop', 'somedayScrollTop', 'selectedId']);
  text(v.query);
  if (v.state !== 'all' && !STATES.includes(v.state as ListView['state'] & typeof STATES[number])) invalid();
  if (v.theme !== 'all' && v.theme !== 'none') uuid(v.theme);
  if (!['title', 'state', 'updatedAt', 'dueDate', 'reviewDate'].includes(v.sort as string) || !['asc', 'desc'].includes(v.direction as string)) invalid();
  if (!Array.isArray(v.columns) || new Set(v.columns).size !== v.columns.length || v.columns.some(column => !OPTIONAL_COLUMNS.includes(column))) invalid();
  if (typeof v.showClosed !== 'boolean' || typeof v.includeArchived !== 'boolean') invalid();
  for (const field of ['scrollTop', 'scrollLeft', 'mainScrollTop', 'somedayScrollTop']) if (typeof v[field] !== 'number' || !Number.isFinite(v[field]) || (v[field] as number) < 0) invalid();
  if (v.selectedId !== null) uuid(v.selectedId);
  return structuredClone(v) as ListView;
}
