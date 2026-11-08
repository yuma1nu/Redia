import { documentDraftKey } from '../shared/documents.ts';
import type { DocumentDraft, DocumentEdit, DocumentRequest, DocumentResponse } from '../shared/documents.ts';
type Buffer = { draft: DocumentDraft; dirty: boolean; safe: boolean; hold: boolean; status: 'saved' | 'saving' | 'draft' | 'error'; error: string };
export class DocumentEditor {
  private state: Buffer | undefined;
  private listeners = new Set<() => void>();
  private staged: Promise<void> = Promise.resolve();
  private saving?: Promise<boolean>;
  private timer?: ReturnType<typeof setTimeout>;
  private send: (input: DocumentRequest) => Promise<DocumentResponse>;
  private refresh: () => Promise<void>;
  constructor(send: (input: DocumentRequest) => Promise<DocumentResponse>, refresh: () => Promise<void>) { this.send = send; this.refresh = refresh; }
  getSnapshot = () => this.state;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  private emit(value: Buffer) { this.state = value; this.listeners.forEach(callback => callback()); }
  begin(edit: DocumentEdit) {
    if (this.state?.dirty && documentDraftKey(this.state.draft.edit) === documentDraftKey(edit)) return;
    if (this.state?.dirty) throw new Error('未保存の資料編集を先に確認してください。');
    this.emit({ draft: { token: crypto.randomUUID(), edit }, dirty: false, safe: true, hold: false, status: 'saved', error: '' });
  }
  restore(draft: DocumentDraft) { this.emit({ draft, dirty: true, safe: true, hold: false, status: 'draft', error: '' }); }
  change(edit: DocumentEdit, hold = false) {
    const current = this.state;
    const entry: Buffer = { draft: { token: crypto.randomUUID(), edit: { ...edit, revision: current?.draft.edit.revision ?? edit.revision } }, dirty: true, safe: false, hold, status: 'draft', error: '' };
    this.emit(entry); this.stage(entry); clearTimeout(this.timer);
    if (!hold) this.timer = setTimeout(() => { void this.save(); }, 450);
  }
  private stage(entry: Buffer) {
    this.staged = this.staged.then(async () => {
      try { await this.send({ action: 'stage-edit', draft: entry.draft }); if (this.state?.draft.token === entry.draft.token) this.emit({ ...this.state, safe: true }); }
      catch (error) { if (this.state?.draft.token === entry.draft.token) this.emit({ ...this.state, safe: false, status: 'error', error: error instanceof Error ? error.message : '下書きを退避できませんでした。' }); }
    });
  }
  save(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.saving) return this.saving;
    this.saving = this.loop().finally(() => { this.saving = undefined; }); return this.saving;
  }
  private async loop(): Promise<boolean> {
    for (;;) {
      let last: Promise<void>; do { last = this.staged; await last; } while (last !== this.staged);
      const entry = this.state;
      if (!entry?.dirty) return true;
      if (entry.hold) return false;
      if (!entry.safe) { this.stage(entry); await this.staged; if (!this.state?.safe) return false; continue; }
      this.emit({ ...entry, status: 'saving', error: '' });
      try {
        const value = await this.send({ action: 'commit-edit', draft: entry.draft }) as { revision: number };
        const current = this.state!;
        if (current.draft.token === entry.draft.token) this.emit({ ...current, draft: { ...current.draft, edit: { ...current.draft.edit, revision: value.revision } }, dirty: false, safe: true, status: 'saved', error: '' });
        else {
          const next = { ...current, draft: { ...current.draft, edit: { ...current.draft.edit, revision: value.revision } }, safe: false };
          this.emit(next); this.stage(next);
        }
        await this.refresh();
      } catch (error) {
        if (this.state) this.emit({ ...this.state, status: 'error', error: error instanceof Error ? error.message : '保存できませんでした。入力を保持しています。' });
        return false;
      }
    }
  }
  async flush() { const ready = await this.save(); return { ready, draftsSafe: !this.state?.dirty || !!this.state.safe }; }
  async discard() {
    clearTimeout(this.timer); await this.staged;
    if (this.saving) await this.saving;
    const entry = this.state; if (!entry) return;
    await this.send({ action: 'discard-edit', draft: entry.draft }); this.state = undefined; this.listeners.forEach(callback => callback()); await this.refresh();
  }
}

// Each related page owns an independent buffer, including when several rows are edited quickly.
export class DocumentEditorPool {
  private editors = new Map<string, DocumentEditor>();
  private listeners = new Set<() => void>();
  private snapshot: Buffer | undefined;
  private pending: Buffer[] = [];
  private send: (input: DocumentRequest) => Promise<DocumentResponse>;
  private refresh: () => Promise<void>;
  constructor(send: (input: DocumentRequest) => Promise<DocumentResponse>, refresh: () => Promise<void>) { this.send = send; this.refresh = refresh; }
  get(edit: DocumentEdit) {
    const key = documentDraftKey(edit);
    if (!this.editors.has(key)) {
      const editor = new DocumentEditor(this.send, this.refresh);
      editor.subscribe(() => { this.pending = [...this.editors.values()].map(editor => editor.getSnapshot()).filter((buffer): buffer is Buffer => !!buffer?.dirty); this.snapshot = this.pending.find(buffer => buffer.status === 'error') ?? this.pending[0]; this.listeners.forEach(callback => callback()); });
      this.editors.set(key, editor);
    }
    return this.editors.get(key)!;
  }
  getSnapshot = (match?: (edit: DocumentEdit) => boolean) => { if (!match) return this.snapshot; const buffers = this.pending.filter(buffer => match(buffer.draft.edit)); return buffers.find(buffer => buffer.status === 'error') ?? buffers[0]; };
  getPending = () => this.pending;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  hasDirty(edit: DocumentEdit) { return !!this.editors.get(documentDraftKey(edit))?.getSnapshot()?.dirty; }
  async flush(match?: (edit: DocumentEdit) => boolean) { const results = await Promise.all([...this.editors.values()].filter(editor => { const edit=editor.getSnapshot()?.draft.edit; return edit && (!match || match(edit)); }).map(editor => editor.flush())); return { ready: results.every(result => result.ready), draftsSafe: results.every(result => result.draftsSafe) }; }
}
