export const STATES = ['未着手', '進行中', '待ち', '完了', '中止', 'いつか'] as const;
export type ItemState = typeof STATES[number];
export type ItemFields = {
  title: string; state: ItemState; themeId: string | null; summary: string;
  body: string; bodyJson?: string | null; dueDate: string | null; reviewDate: string | null;
};
export type ThemeFields = { name: string; description: string };
export type Item = ItemFields & { id: string; revision: number; createdAt: string; updatedAt: string; archived: boolean };
export type Theme = ThemeFields & { id: string; revision: number; createdAt: string; updatedAt: string; archived: boolean };
export type ItemLink = { sourceId: string; targetId: string; kind: 'related' | 'derived' };
export type DraftRef = { kind: 'item' | 'theme' | 'new-item' | 'new-theme'; id: string };
export type NewItemFields = { title: string; themeId: string | null; originId: string | null };
export type DraftFields = ItemFields | ThemeFields | NewItemFields | { name: string };
export type DraftInput = { ref: DraftRef; token: string; baseRevision: number; fields: DraftFields };
export type Draft = DraftInput & { savedAt: string };
export type WorkspaceSnapshot = { themes: Theme[]; items: Item[]; links: ItemLink[]; drafts: Draft[]; views: Record<string, ListView> };
export type Commit = { item?: Item; theme?: Theme; link?: ItemLink };
export type Failure = { code: 'INVALID_INPUT' | 'CONFLICT' | 'NOT_FOUND' | 'STORAGE_FAILED'; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };
export const draftKey = (ref: DraftRef) => `${ref.kind}:${ref.id}`;
export const isHomeItem = (item: Pick<Item, 'state'>) => ['未着手', '進行中', '待ち'].includes(item.state);
export const OPTIONAL_COLUMNS = ['dueDate', 'reviewDate', 'updatedAt'] as const;
export type OptionalColumn = typeof OPTIONAL_COLUMNS[number];
export type ListView = {
  query: string; state: ItemState | 'all'; theme: string; sort: 'title' | 'state' | 'updatedAt' | 'dueDate' | 'reviewDate';
  direction: 'asc' | 'desc'; columns: OptionalColumn[]; showClosed: boolean; includeArchived: boolean;
  scrollTop: number; scrollLeft: number; mainScrollTop: number; somedayScrollTop: number; selectedId: string | null;
};
export type ArchiveInput = { kind: 'item' | 'theme'; id: string; archived: boolean; baseRevision: number };

export function isSubmitKey(event: { key: string; isComposing: boolean; keyCode?: number }) {
  return event.key === 'Enter' && !event.isComposing && event.keyCode !== 229;
}
