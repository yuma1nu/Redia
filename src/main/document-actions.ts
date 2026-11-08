import { DomainError, invalid, record, uuid } from '../shared/validation.ts';
import { DocumentRepository, normalizeReference } from './documents.ts';
import { DocumentDraftJournal, validateDocumentDraft } from './document-drafts.ts';
import type { DocumentRegistration } from '../shared/documents.ts';
import type { Result } from '../shared/model.ts';

export class DocumentActions {
  readonly repository: DocumentRepository;
  private system: { pick: (kind: 'file' | 'folder') => Promise<DocumentRegistration[]>; openPath: (path: string) => Promise<string>; openExternal: (url: string) => Promise<void> };
  private journal?: DocumentDraftJournal;
  constructor(repository: DocumentRepository, system: DocumentActions['system'], journal?: DocumentDraftJournal) { this.repository = repository; this.system = system; this.journal = journal; }
  async request(raw: unknown): Promise<Result<unknown>> {
    try {
      const action = raw && typeof raw === 'object' ? (raw as { action?: unknown }).action : null;
      if (action === 'stage-edit' || action === 'commit-edit' || action === 'discard-edit') {
        const r = record(raw, ['action', 'draft']), draft = validateDocumentDraft(r.draft);
        if (!this.journal) throw new Error('Draft journal not configured');
        if (action === 'stage-edit') { this.journal.stage(draft); return { ok: true, value: null }; }
        if (action === 'discard-edit') { this.journal.clear(draft); return { ok: true, value: null }; }
        const applied = this.repository.applied(draft);
        if (applied !== undefined) return { ok: true, value: { revision: applied } };
        const stored = this.journal.read(draft);
        if (!stored || stored.token !== draft.token) throw new DomainError('CONFLICT', '資料の下書きが更新されています。再試行してください。');
        const revision = this.repository.commitEdit(stored);
        try { this.journal.clear(stored); } catch { /* Applied token suppresses stale recovery. */ }
        return { ok: true, value: { revision } };
      }
      if (action === 'list') { record(raw, ['action']); return { ok: true, value: { ...this.repository.snapshot(), drafts: this.journal?.list().filter(draft => this.repository.applied(draft) === undefined) ?? [] } }; }
      if (action === 'pick') {
        const r = record(raw, ['action', 'kind']); if (r.kind !== 'file' && r.kind !== 'folder') invalid();
        return { ok: true, value: await this.system.pick(r.kind) };
      }
      if (action === 'open') {
        const r = record(raw, ['action', 'id']), doc = this.repository.get(uuid(r.id));
        const target = normalizeReference(doc.reference, doc.kind);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const opening = target.kind === 'url' ? this.system.openExternal(target.reference).then(() => '') : this.system.openPath(target.reference);
          const error = await Promise.race([opening, new Promise<string>(resolve => { timer = setTimeout(() => resolve('参照先から応答がありません。接続状態を確認してください。OS側の起動処理は後から完了する場合があります。'), 5000); })]);
          if (error) throw new Error(error);
        } catch (error) { throw new DomainError('NOT_FOUND', `${target.reference}\n${error instanceof Error ? error.message : '既定のアプリで開けませんでした。'}`); }
        finally { clearTimeout(timer); }
        return { ok: true, value: null };
      }
      return { ok: true, value: await this.repository.request(raw) };
    } catch (error) {
      return { ok: false, error: { code: error instanceof DomainError ? error.code : 'STORAGE_FAILED', message: error instanceof DomainError ? error.message : '資料情報を保存できませんでした。入力を保持しています。再試行してください。' } };
    }
  }
}
