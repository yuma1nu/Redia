export type DocumentKind = 'file' | 'folder' | 'url';
export type DocumentContext = { kind: 'item' | 'theme'; id: string };
export type WorkspaceDocument = { id: string; name: string; reference: string; normalized: string; kind: DocumentKind; description: string; revision: number; createdAt: string; updatedAt: string };
export type DocumentUse = { documentId: string; kind: 'item' | 'theme'; contextId: string; memo: string; group: string; position: number; revision: number };
export type DocumentView = { query: string; kind: string; theme: string; sort: string; scroll: number; selected: string };
export type DocumentSnapshot = { documents: WorkspaceDocument[]; uses: DocumentUse[]; view?: DocumentView; themeOrders?: Record<string,string[]> };
export type DocumentEdit = Extract<DocumentRequest, { action: 'edit' | 'use' }>;
export type DocumentDraft = { token: string; edit: DocumentEdit };
export type DocumentRecovery = DocumentSnapshot & { drafts?: DocumentDraft[] };
export const documentDraftKey = (edit: DocumentEdit) => edit.action === 'edit' ? `document-${edit.id}` : `use-${edit.id}-${edit.context.kind}-${edit.context.id}`;
export type DocumentRegistration = { reference: string; kind?: DocumentKind; name?: string };
export type DocumentBatch = { registered: string[]; reused: string[]; failed: (DocumentRegistration & { message: string })[] };
export type DocumentRequest =
  | { action: 'list' }
  | { action: 'view'; view: DocumentView }
  | { action: 'stage-edit'; draft: DocumentDraft }
  | { action: 'commit-edit'; draft: DocumentDraft }
  | { action: 'discard-edit'; draft: DocumentDraft }
  | { action: 'register'; entries: DocumentRegistration[]; context: DocumentContext | null }
  | { action: 'edit'; id: string; revision: number; name: string; reference: string; description: string; kind: DocumentKind }
  | { action: 'attach'; id: string; context: DocumentContext }
  | { action: 'reorder'; context: DocumentContext; ids: string[]; revisions: number[] }
  | { action: 'use'; id: string; context: DocumentContext; revision: number; memo: string; group: string; position: number }
  | { action: 'detach'; id: string; context: DocumentContext; revision: number }
  | { action: 'remove'; id: string; revision: number; linkCount: number }
  | { action: 'open'; id: string }
  | { action: 'pick'; kind: 'file' | 'folder' };
export type DocumentResponse = DocumentRecovery | DocumentBatch | DocumentRegistration[] | { revision: number } | null;

export function documentUses(data: DocumentSnapshot, context: DocumentContext, items: { id: string; themeId: string | null }[]) {
  return data.uses.filter(use => use.kind === context.kind && use.contextId === context.id || context.kind === 'theme' && use.kind === 'item' && items.some(item => item.id === use.contextId && item.themeId === context.id));
}
