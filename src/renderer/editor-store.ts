import { draftKey } from '../shared/model.ts';
import type { Commit, Draft, DraftFields, DraftInput, DraftRef, Item, ItemFields, Result, Theme, ThemeFields, WorkspaceSnapshot } from '../shared/model.ts';
import type { WorkspaceApi } from '../shared/api.ts';
export type EditorApi = Pick<WorkspaceApi, 'getWorkspace' | 'stageDraft' | 'commitDraft' | 'discardDraft' | 'addLink' | 'removeLink'>;

export type Buffer = DraftInput & { dirty: boolean; safe: boolean; hold: boolean; status: 'saved' | 'staging' | 'saving' | 'error'; error?: string; conflict?: boolean };
type State = { data: WorkspaceSnapshot; buffers: Record<string, Buffer>; recovery: Draft[]; loading: boolean; error?: string };
const empty: WorkspaceSnapshot = { items: [], themes: [], links: [], drafts: [], views: {} };
export function itemFields(item: Item): ItemFields {
  const { title, state, themeId, summary, body, bodyJson, dueDate, reviewDate } = item;
  return { title, state, themeId, summary, body, ...(bodyJson!==undefined?{bodyJson}:{}), dueDate, reviewDate };
}
export function themeFields(theme: Theme): ThemeFields { return { name: theme.name, description: theme.description }; }
function failure<T>(error: unknown): Result<T> {
  return { ok: false, error: { code: 'STORAGE_FAILED', message: error instanceof Error ? 'アプリとの通信に失敗しました。入力を保持しています。再試行してください。' : '保存できませんでした。' } };
}

export class EditorStore {
  private api: EditorApi;
  private state: State = { data: empty, buffers: {}, recovery: [], loading: true };
  private listeners = new Set<() => void>();
  private staging = new Map<string, Promise<void>>();
  private saving = new Map<string, Promise<boolean>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private disposed = false;
  constructor(api: EditorApi) { this.api = api; }
  getSnapshot = () => this.state;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  private emit(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private put(buffer: Buffer) { this.emit({ buffers: { ...this.state.buffers, [draftKey(buffer.ref)]: buffer } }); }
  async load() {
    const result = await this.api.getWorkspace().catch(failure<WorkspaceSnapshot>);
    if (!this.disposed) {
      if (result.ok) this.emit({ data: result.value, recovery: result.value.drafts, loading: false, error: undefined });
      else this.emit({ loading: false, error: result.error.message });
    }
  }
  buffer(ref: DraftRef): Buffer {
    const existing = this.state.buffers[draftKey(ref)];
    if (existing) return existing;
    const entity = ref.kind === 'item' ? this.state.data.items.find(item => item.id === ref.id) : this.state.data.themes.find(theme => theme.id === ref.id);
    if (!entity) throw new Error('ページが見つかりません。');
    const fields = ref.kind === 'item' ? itemFields(entity as Item) : themeFields(entity as Theme);
    return { ref, fields, token: crypto.randomUUID(), baseRevision: entity.revision, dirty: false, safe: true, hold: false, status: 'saved' };
  }
  create(kind: 'new-item' | 'new-theme', themeId: string | null = null, originId: string | null = null): DraftRef {
    const ref = { kind, id: crypto.randomUUID() };
    this.put({ ref, token: crypto.randomUUID(), baseRevision: 0,
      fields: kind === 'new-theme' ? { name: '' } : { title: '', themeId, originId }, dirty: false, safe: true, hold: false, status: 'saved' });
    return ref;
  }
  edit(ref: DraftRef, patch: Partial<DraftFields>, hold = false) {
    const before = this.buffer(ref);
    const entry: Buffer = { ...before, fields: { ...before.fields, ...patch } as DraftFields,
      token: crypto.randomUUID(), dirty: true, safe: false, hold, status: 'staging', error: undefined, conflict: false };
    this.put(entry);
    this.stage(entry);
    const key = draftKey(ref);
    clearTimeout(this.timers.get(key));
    if (!hold && !ref.kind.startsWith('new-')) this.timers.set(key, setTimeout(() => { void this.save(ref); }, 450));
  }
  private stage(entry: Buffer) {
    const key = draftKey(entry.ref);
    const input: DraftInput = { ref: entry.ref, token: entry.token, baseRevision: entry.baseRevision, fields: entry.fields };
    const queued = (this.staging.get(key) ?? Promise.resolve()).then(async () => {
      const result = await this.api.stageDraft(input).catch(failure<null>);
      const current = this.state.buffers[key];
      if (current?.token === entry.token) this.put({ ...current, safe: result.ok, status: result.ok ? current.status : 'error', error: result.ok ? current.error : result.error.message });
    });
    this.staging.set(key, queued);
  }
  save(ref: DraftRef): Promise<boolean> {
    const key = draftKey(ref);
    clearTimeout(this.timers.get(key));
    if (this.saving.has(key)) return this.saving.get(key)!;
    const work = this.saveLoop(ref).finally(() => { this.saving.delete(key); });
    this.saving.set(key, work);
    return work;
  }
  private async saveLoop(ref: DraftRef): Promise<boolean> {
    const key = draftKey(ref);
    for (;;) {
      // Await the latest stage; more input can arrive while the previous stage is in flight.
      let pending: Promise<void> | undefined;
      do { pending = this.staging.get(key); await pending; } while (pending !== this.staging.get(key));
      const entry = this.state.buffers[key];
      if (!entry?.dirty) return true;
      if (entry.hold) return false;
      if (!entry.safe) {
        this.stage(entry); await this.staging.get(key);
        if (!this.state.buffers[key].safe) return false;
        continue;
      }
      this.put({ ...entry, status: 'saving', error: undefined });
      const result = await this.api.commitDraft({ ref, token: entry.token }).catch(failure<Commit>);
      const current = this.state.buffers[key];
      if (!result.ok) {
        if (current.token !== entry.token && result.error.code === 'INVALID_INPUT') continue;
        this.put({ ...current, status: 'error', error: result.error.message, conflict: result.error.code === 'CONFLICT' });
        return false;
      }
      this.apply(result.value);
      const entity = result.value.item ?? result.value.theme!;
      if (current.token === entry.token) {
        const fields = ref.kind === 'item' ? itemFields(entity as Item) : ref.kind === 'theme' ? themeFields(entity as Theme) : current.fields;
        this.put({ ...current, fields, baseRevision: entity.revision, dirty: false, safe: true, status: 'saved', error: undefined });
        return true;
      }
      const newer = { ...current, baseRevision: entity.revision, safe: false };
      this.put(newer);
      this.stage(newer);
    }
  }
  apply(commit: Commit) {
    const data = { ...this.state.data };
    const buffers = { ...this.state.buffers };
    for (const [kind, entity] of [['item', commit.item], ['theme', commit.theme]] as const) {
      if (!entity) continue;
      const key = `${kind}:${entity.id}`, buffer = buffers[key];
      if (buffer && !buffer.dirty) buffers[key] = { ...buffer, baseRevision: entity.revision, fields: kind === 'item' ? itemFields(entity as Item) : themeFields(entity as Theme) };
    }
    if (commit.item) data.items = [...data.items.filter(item => item.id !== commit.item!.id), commit.item].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    if (commit.theme) data.themes = [...data.themes.filter(theme => theme.id !== commit.theme!.id), commit.theme];
    if (commit.link && !data.links.some(link => link.sourceId === commit.link!.sourceId && link.targetId === commit.link!.targetId)) data.links = [...data.links, commit.link];
    this.emit({ data, buffers });
  }
  restore(draft: Draft) {
    this.put({ ...draft, dirty: true, safe: true, hold: false, status: 'staging' });
    this.emit({ recovery: this.state.recovery.filter(other => draftKey(other.ref) !== draftKey(draft.ref)) });
    if (!draft.ref.kind.startsWith('new-')) void this.save(draft.ref);
  }
  async discard(ref: DraftRef, token: string) {
    await this.staging.get(draftKey(ref));
    const result = await this.api.discardDraft({ ref, token }).catch(failure<null>);
    if (result.ok) {
      const buffers = { ...this.state.buffers }; delete buffers[draftKey(ref)];
      this.emit({ buffers, recovery: this.state.recovery.filter(draft => draftKey(draft.ref) !== draftKey(ref)) });
    } else this.emit({ error: result.error.message });
    return result.ok;
  }
  async rebase(ref: DraftRef) {
    const result = await this.api.getWorkspace().catch(failure<WorkspaceSnapshot>);
    if (!result.ok) return;
    const entity = ref.kind === 'item' ? result.value.items.find(item => item.id === ref.id) : result.value.themes.find(theme => theme.id === ref.id);
    if (!entity) return;
    this.emit({ data: result.value });
    const current = this.buffer(ref);
    this.put({ ...current, baseRevision: entity.revision });
    this.edit(ref, {});
    await this.save(ref);
  }
  async flush(): Promise<{ ready: boolean; draftsSafe: boolean }> {
    const refs = Object.values(this.state.buffers).filter(buffer => buffer.dirty).map(buffer => buffer.ref);
    await Promise.all(refs.filter(ref => !ref.kind.startsWith('new-')).map(ref => this.save(ref)));
    await Promise.all(this.staging.values());
    const pending = Object.values(this.state.buffers).filter(buffer => buffer.dirty);
    return { ready: pending.every(buffer => buffer.ref.kind.startsWith('new-') && buffer.safe), draftsSafe: pending.every(buffer => buffer.safe) };
  }
  async link(sourceId: string, targetId: string) {
    const result = await this.api.addLink({ sourceId, targetId }).catch(failure<never>);
    if (result.ok) this.apply({ link: result.value });
    return result;
  }
  async unlink(sourceId: string, targetId: string) {
    const result = await this.api.removeLink({ sourceId, targetId }).catch(failure<null>);
    if (result.ok) this.emit({ data: { ...this.state.data, links: this.state.data.links.filter(link => !((link.sourceId === sourceId && link.targetId === targetId) || (link.sourceId === targetId && link.targetId === sourceId))) } });
    return result;
  }
  dispose() { this.disposed = true; this.timers.forEach(clearTimeout); this.listeners.clear(); }
}
