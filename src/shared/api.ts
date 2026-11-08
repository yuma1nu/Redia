import type { ArchiveInput, Commit, DraftInput, DraftRef, ItemLink, ListView, Result, WorkspaceSnapshot } from './model';
export type AppInfo = Readonly<{
  version: string;
  environment: 'development' | 'test' | 'production';
}>;

export interface WorkspaceApi {
  backups(input:{action:'list'|'choose'}|{action:'restore';name:string}):Promise<Result<{directory:string;generations:{name:string;createdAt:string}[]}>>;
  copyPlanImage(input:{png:string}):Promise<Result<null>>;
  plans(input: import('./plans').PlanRequest): Promise<Result<import('./plans').PlanResponse>>;
  bodyMenu(input: import('./body-menu').BodyMenuState): Promise<Result<import('./body-menu').BodyMenuCommand|null>>;
  images(input: import('./images').ImageRequest): Promise<Result<import('./images').ImageResponse>>;
  search(input: import('./search').SearchRequest): Promise<Result<import('./search').SearchResponse|null>>;
  documents(input: import('./documents').DocumentRequest): Promise<Result<import('./documents').DocumentResponse>>;
  dropDocuments(files: File[], context: import('./documents').DocumentContext | null): Promise<Result<import('./documents').DocumentResponse>>;
  getAppInfo(): Promise<AppInfo>;
  getWorkspace(): Promise<Result<WorkspaceSnapshot>>;
  stageDraft(input: DraftInput): Promise<Result<null>>;
  commitDraft(input: { ref: DraftRef; token: string }): Promise<Result<Commit>>;
  discardDraft(input: { ref: DraftRef; token: string }): Promise<Result<null>>;
  addLink(input: { sourceId: string; targetId: string }): Promise<Result<ItemLink>>;
  removeLink(input: { sourceId: string; targetId: string }): Promise<Result<null>>;
  createBackup(): Promise<Result<{ name: string; createdAt: string }>>;
  setArchived(input: ArchiveInput): Promise<Result<Commit>>;
  saveListView(input: { key: string; view: ListView }): Promise<Result<null>>;
  onCloseRequested(callback: (requestId: string) => void): () => void;
  respondToClose(input: { requestId: string; ready: boolean; draftsSafe: boolean; backupFailed?:boolean; reason?: 'operation' | 'registration' }): void;
}

export const APP_INFO_CHANNEL = 'workspace:app-info';
export const REQUEST_CHANNEL = 'workspace:request';
export const CLOSE_REQUEST_CHANNEL = 'workspace:close-request';
export const CLOSE_RESPONSE_CHANNEL = 'workspace:close-response';

export function validateEmptyRequest(args: unknown[]): void {
  if (args.length !== 0) throw new Error('This operation accepts no arguments.');
}
