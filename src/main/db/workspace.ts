import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { migrate, migrations } from './migrations.ts';
import { DomainError, validateDraft, validateView, validateViewKey } from '../../shared/validation.ts';
import type { ArchiveInput, ListView } from '../../shared/model.ts';
import type { Commit, DraftInput, DraftRef, Item, ItemFields, ItemLink, NewItemFields, Theme, ThemeFields } from '../../shared/model.ts';

export class WorkspaceDatabase {
  readonly db: DatabaseSync;
  constructor(path: string) {
    const existed = existsSync(path);
    this.db = new DatabaseSync(path);
    try {
      if (this.db.prepare('PRAGMA quick_check').get()!.quick_check !== 'ok') throw new Error('DBの整合性確認に失敗しました。');
      const version = Number(this.db.prepare('PRAGMA user_version').get()!.user_version);
      if (version > migrations.at(-1)!.version) throw new Error('このDBには新しいアプリが必要です。');
      // Migrations run before WAL is enabled; checkpoint old WAL before snapshotting.
      if (existed && version < migrations.at(-1)!.version) {
        this.db.prepare('VACUUM INTO ?').run(`${path}.before-v${version + 1}-${Date.now()}.bak`);
      }
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 1500');
      migrate(this.db);
      this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL');
    } catch (error) { this.db.close(); throw error; }
  }
  close() { this.db.close(); }
  themes(): Theme[] { return this.db.prepare('SELECT id,name,description,revision,createdAt,updatedAt,archived FROM themes ORDER BY createdAt,id').all().map(row => ({ ...row, archived: !!row.archived })) as unknown as Theme[]; }
  items(): Item[] { return this.db.prepare(`SELECT id,title,state,themeId,summary,body,bodyJson,dueDate,reviewDate,revision,createdAt,updatedAt,archived FROM items ORDER BY createdAt,id`).all().map(row => ({ ...row, archived: !!row.archived })) as unknown as Item[]; }
  links(): ItemLink[] { return this.db.prepare('SELECT * FROM item_links').all() as unknown as ItemLink[]; }
  item(id: string): Item { const item = this.db.prepare('SELECT id,title,state,themeId,summary,body,bodyJson,dueDate,reviewDate,revision,createdAt,updatedAt,archived FROM items WHERE id=?').get(id); if (!item) throw new DomainError('NOT_FOUND', 'ページが見つかりません。'); return { ...item, archived: !!item.archived } as unknown as Item; }
  theme(id: string): Theme { const theme = this.db.prepare('SELECT id,name,description,revision,createdAt,updatedAt,archived FROM themes WHERE id=?').get(id); if (!theme) throw new DomainError('NOT_FOUND', 'テーマが見つかりません。'); return { ...theme, archived: !!theme.archived } as unknown as Theme; }
  private activeTheme(id: string) { if (this.theme(id).archived) throw new DomainError('CONFLICT', '所属テーマを復元してから編集してください。入力は保持しています。'); }
  private activeItem(item: Item) {
    if (item.archived) throw new DomainError('CONFLICT', 'ページを復元してから編集してください。入力は保持しています。');
    if (item.themeId) this.activeTheme(item.themeId);
  }
  views(): Record<string, ListView> {
    return Object.fromEntries(this.db.prepare('SELECT key,value FROM view_settings').all().map(row => [validateViewKey(row.key), validateView(JSON.parse(String(row.value)))]));
  }
  saveView(key: string, view: ListView) { this.db.prepare('INSERT INTO view_settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(view)); }
  setArchived(input: ArchiveInput): Commit {
    const current = input.kind === 'item' ? this.item(input.id) : this.theme(input.id);
    if (current.archived !== input.archived) {
      const table = input.kind === 'item' ? 'items' : 'themes';
      const result = this.db.prepare(`UPDATE ${table} SET archived=?,revision=revision+1,updatedAt=? WHERE id=? AND revision=?`).run(Number(input.archived), new Date().toISOString(), input.id, input.baseRevision);
      if (!result.changes) throw new DomainError('CONFLICT', '保存済みの内容が変わっています。再読み込みして再試行してください。');
    }
    return input.kind === 'item' ? { item: this.item(input.id) } : { theme: this.theme(input.id) };
  }
  applied(token: string): boolean { return !!this.db.prepare('SELECT 1 FROM applied_edits WHERE token=?').get(token); }
  appliedResult(ref: DraftRef, token: string): Commit | undefined {
    const applied = this.db.prepare('SELECT entityId,kind FROM applied_edits WHERE token=?').get(token);
    if (!applied) return undefined;
    if (applied.entityId !== ref.id || applied.kind !== ref.kind) throw new DomainError('CONFLICT', '保存要求が一致しません。');
    return ref.kind.endsWith('item') ? { item: this.item(ref.id), link: this.links().find(link => link.targetId === ref.id) } : { theme: this.theme(ref.id) };
  }

  commit(raw: DraftInput): Commit {
    const { ref, token, baseRevision, fields } = validateDraft(raw, true);
    const applied = this.appliedResult(ref, token);
    if (applied) return applied;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let result: Commit;
      const now = new Date().toISOString();
      if (ref.kind === 'new-theme') {
        this.db.prepare('INSERT INTO themes(id,name,createdAt,updatedAt) VALUES (?,?,?,?)').run(ref.id, (fields as { name: string }).name.trim(), now, now);
        result = { theme: this.theme(ref.id) };
      } else if (ref.kind === 'new-item') {
        const f = fields as NewItemFields;
        const origin = f.originId ? this.item(f.originId) : undefined;
        if (origin) this.activeItem(origin);
        const themeId = origin ? origin.themeId : f.themeId;
        if (themeId) this.activeTheme(themeId);
        this.db.prepare('INSERT INTO items(id,title,state,themeId,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run(ref.id, f.title.trim(), '未着手', themeId, now, now);
        const link: ItemLink | undefined = origin ? { sourceId: origin.id, targetId: ref.id, kind: 'related' } : undefined;
        if (link) this.db.prepare('INSERT INTO item_links VALUES (?,?,?)').run(link.sourceId, link.targetId, link.kind);
        result = { item: this.item(ref.id), link };
      } else if (ref.kind === 'theme') {
        this.activeTheme(ref.id);
        const f = fields as ThemeFields;
        const update = this.db.prepare('UPDATE themes SET name=?,description=?,revision=revision+1,updatedAt=? WHERE id=? AND revision=?').run(f.name.trim(), f.description, now, ref.id, baseRevision);
        if (!update.changes) throw new DomainError('CONFLICT', '別の変更が保存されています。入力を下書きに保持しました。');
        result = { theme: this.theme(ref.id) };
      } else {
        this.activeItem(this.item(ref.id));
        const f = fields as ItemFields;
        if (f.themeId) this.activeTheme(f.themeId);
        const update = this.db.prepare(`UPDATE items SET title=?,state=?,themeId=?,summary=?,body=?,bodyJson=?,dueDate=?,reviewDate=?,revision=revision+1,updatedAt=? WHERE id=? AND revision=?`).run(f.title.trim(), f.state, f.themeId, f.summary, f.body, f.bodyJson ?? null, f.dueDate, f.reviewDate, now, ref.id, baseRevision);
        if (!update.changes) throw new DomainError('CONFLICT', '別の変更が保存されています。入力を下書きに保持しました。');
        result = { item: this.item(ref.id) };
      }
      this.db.prepare('INSERT INTO applied_edits VALUES (?,?,?)').run(token, ref.id, ref.kind);
      this.db.exec('COMMIT');
      return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  addLink(sourceId: string, targetId: string): ItemLink {
    this.item(sourceId); this.item(targetId);
    const existing = this.links().find(link => (link.sourceId === sourceId && link.targetId === targetId) || (link.sourceId === targetId && link.targetId === sourceId));
    if (existing) return existing;
    this.db.prepare("INSERT INTO item_links VALUES (?,?,'related')").run(sourceId, targetId);
    return { sourceId, targetId, kind: 'related' };
  }
  removeLink(sourceId: string, targetId: string) { this.db.prepare('DELETE FROM item_links WHERE (sourceId=? AND targetId=?) OR (sourceId=? AND targetId=?)').run(sourceId, targetId, targetId, sourceId); }
}
