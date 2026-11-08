import { WorkspaceDatabase } from './db/workspace.ts';
import { PlanRepository } from './plans.ts';
import { SearchEngine } from './search.ts';
import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { imageId, parseBody } from '../shared/body.ts';
import type { BodyNode } from '../shared/body.ts';
import { DraftJournal } from './drafts.ts';
import { createBackup } from './backup.ts';
import { DomainError, record, validateArchive, validateDraft, validateDraftAction, validateLink, validateView, validateViewKey } from '../shared/validation.ts';
import type { Result } from '../shared/model.ts';

export class WorkspaceService {
  readonly database: WorkspaceDatabase;
  readonly journal: DraftJournal;
  readonly search: SearchEngine;
  readonly plans: PlanRepository;
  private queue: Promise<unknown> = Promise.resolve();
  private paths: { database: string; drafts: string; backups: string; attachments: string };
  private log: (message: string) => void;
  constructor(paths: { database: string; drafts: string; backups: string; attachments: string }, log: (message: string) => void = () => {}) {
    this.paths = paths; this.log = log;
    this.database = new WorkspaceDatabase(paths.database);
    this.search = new SearchEngine(this.database);
    this.journal = new DraftJournal(paths.drafts);
    this.plans = new PlanRepository(this.database,join(paths.drafts,'plans'));
  }
  request(operation: unknown, input: unknown): Promise<Result<unknown>> {
    const run = this.queue.then(async (): Promise<Result<unknown>> => {
      try { const value=await this.execute(operation, input); if(['commitDraft','setArchived'].includes(String(operation)))this.search.invalidate();return { ok: true, value }; }
      catch (error) {
        if (error instanceof DomainError) return { ok: false, error: { code: error.code, message: error.message } };
        this.log(`storage-error operation=${String(operation)} ${error instanceof Error ? error.name : 'UnknownError'}`);
        const message = operation === 'getWorkspace' ? 'ワークスペースを読み込めませんでした。データを変更せず停止しています。保存先とログを確認してください。'
          : operation === 'search' ? '検索できませんでした。検索語を保持しています。再試行してください。'
          : operation === 'createBackup' ? 'バックアップを作成できませんでした。前の完成済みバックアップは保持しています。空き容量やアクセス権を確認してください。'
          : '保存先に書き込めませんでした。入力を保持しています。空き容量やアクセス権を確認し、再試行してください。';
        return { ok: false, error: { code: 'STORAGE_FAILED', message } };
      }
    });
    this.queue = run;
    return run;
  }
  private async execute(operation: unknown, input: unknown): Promise<unknown> {
    if(operation==='plans')return this.plans.request(input);
    if(operation==='search')return this.search.request(input);
    if (operation === 'getWorkspace') {
      if (input !== null) throw new DomainError('INVALID_INPUT', '引数が不正です。');
      const drafts = this.journal.list().filter(draft => !this.database.applied(draft.token));
      return { themes: this.database.themes(), items: this.database.items(), links: this.database.links(), drafts, views: this.database.views() };
    }
    if (operation === 'setArchived') return this.database.setArchived(validateArchive(input));
    if (operation === 'saveListView') {
      const request = record(input, ['key', 'view']);
      this.database.saveView(validateViewKey(request.key), validateView(request.view)); return null;
    }
    if (operation === 'stageDraft') { this.journal.stage(validateDraft(input)); return null; }
    if (operation === 'commitDraft' || operation === 'discardDraft') {
      const { ref, token } = validateDraftAction(input);
      if (operation === 'commitDraft') {
        const applied = this.database.appliedResult(ref, token);
        if (applied) return applied;
      }
      const draft = this.journal.read(ref);
      if (!draft || draft.token !== token) throw new DomainError('CONFLICT', '下書きが更新されています。最新の入力を再試行してください。');
      if (operation === 'discardDraft') { this.journal.clear(ref, token); return null; }
      if('bodyJson' in draft.fields&&draft.fields.bodyJson){
        const check=(node:BodyNode)=>{if(node.type==='image'){const id=imageId(node.attrs?.src);let valid=false;try{const stat=lstatSync(join(this.paths.attachments,`${id}.png`));valid=!!id&&stat.isFile()&&!stat.isSymbolicLink();}catch{/* Preserve the draft until its image is available. */}if(!valid)throw new DomainError('NOT_FOUND','本文画像を読み取れません。入力を保持しています。画像を確認して再試行してください。');}node.content?.forEach(check);};
        check(parseBody(draft.fields.bodyJson));
      }
      const result = this.database.commit({ ref: draft.ref, token: draft.token, baseRevision: draft.baseRevision, fields: draft.fields });
      // A cleanup error must not turn a committed transaction into an apparent failed save.
      try { this.journal.clear(ref, token); } catch { this.log('draft-cleanup-deferred'); }
      return result;
    }
    if (operation === 'addLink' || operation === 'removeLink') {
      const { sourceId, targetId } = validateLink(input);
      if (operation === 'addLink') return this.database.addLink(sourceId, targetId);
      this.database.removeLink(sourceId, targetId); return null;
    }
    if (operation === 'createBackup') {
      if (input !== null) throw new DomainError('INVALID_INPUT', '引数が不正です。');
      return createBackup(this.database.db, this.paths);
    }
    throw new DomainError('INVALID_INPUT', '未対応の操作です。');
  }
  async close() { await this.queue; this.database.close(); }
}

export function validateRequest(raw: unknown) { return record(raw, ['operation', 'input']); }
