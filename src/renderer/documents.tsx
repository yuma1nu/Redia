import { saveStatus } from '../shared/save-status';
import { AddDocuments } from './document-picker';
import {documentKindFilters,documentType,documentTypeLabels} from '../shared/document-type';
import {DocumentIcon} from './document-icon';
import { selectDocuments } from '../shared/document-list';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { DocumentBatch, DocumentContext, DocumentDraft, DocumentEdit, DocumentRecovery, DocumentRegistration, DocumentRequest, DocumentUse, DocumentView, WorkspaceDocument } from '../shared/documents';
import { documentDraftKey, documentUses } from '../shared/documents';
import { DocumentEditorPool } from './document-editor';
import type { Item, Theme } from '../shared/model';
import { Modal } from './components';
import { Icon } from './icons';

type CatalogView = DocumentView;
let catalogView: CatalogView = { query: '', kind: 'all', theme: 'all', sort: 'name-asc', scroll: 0, selected: '' };
let data: DocumentRecovery = { documents: [], uses: [] }, loadError = '', loaded = false;
let viewError = '', viewDirty = false, viewTimer: ReturnType<typeof setTimeout> | undefined, savingView: Promise<boolean> | undefined;
const listeners = new Set<() => void>();
const closeBlockers = new Set<symbol>();
let activeOperations = 0;
const registrationInputs = new Set<symbol>();
export const documentCloseReason = () => closeBlockers.size || activeOperations ? 'operation' as const : registrationInputs.size ? 'registration' as const : undefined;
let snapshot = { data, loadError, loaded, viewError, viewPending: false };
function emit() { snapshot = { data, loadError, loaded, viewError, viewPending: viewDirty || !!savingView }; listeners.forEach(fn => fn()); }
async function request(input: DocumentRequest) {
  const tracks = !['list','view','stage-edit','commit-edit','discard-edit'].includes(input.action);
  if (tracks) activeOperations++;
  try { const result = await window.workspace.documents(input); if (!result.ok) throw new Error(result.error.message); return result.value; }
  finally { if (tracks) activeOperations--; }
}
export const documentEditor = new DocumentEditorPool(request, loadDocuments);
export const memoEditors = new DocumentEditorPool(request, loadDocuments);
export const flushDocumentEdits = async (match?: (edit: DocumentEdit) => boolean) => {
  const results = await Promise.all([documentEditor.flush(match), memoEditors.flush(match)]);
  return { ready: results.every(result => result.ready), draftsSafe: results.every(result => result.draftsSafe) };
};
const useEdit = (use: DocumentUse): Extract<DocumentEdit, { action: 'use' }> => ({ action: 'use', id: use.documentId, context: { kind: use.kind, id: use.contextId }, revision: use.revision, memo: use.memo, group: use.group, position: use.position });
const memoInputId = (use: DocumentUse) => documentDraftKey(useEdit(use));
export async function loadDocuments() {
  try { data = await request({ action: 'list' }) as DocumentRecovery; data.drafts = data.drafts?.filter(draft => !memoEditors.hasDirty(draft.edit) && !documentEditor.hasDirty(draft.edit)); if (!loaded && data.view) catalogView = data.view; loadError = ''; loaded = true; } catch (error) { loadError = error instanceof Error ? error.message : '資料目録を読み込めませんでした。'; }
  emit();
}
function patchCatalog(patch: Partial<CatalogView>) {
  catalogView = { ...catalogView, ...patch }; viewDirty = true; emit(); clearTimeout(viewTimer); viewTimer = setTimeout(() => { void flushDocumentView(); }, 200);
}
export function flushDocumentView(): Promise<boolean> {
  clearTimeout(viewTimer);
  if (savingView) return savingView;
  savingView = (async () => {
    while (viewDirty) {
      const current = catalogView;
      try { await request({ action: 'view', view: current }); if (catalogView === current) viewDirty = false; viewError = ''; }
      catch (error) { viewError = error instanceof Error ? error.message : '資料目録の表示条件を保存できませんでした。'; emit(); return false; }
    }
    emit(); return true;
  })().finally(() => { savingView = undefined; emit(); });
  return savingView;
}
function useDocuments() { return useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => snapshot); }
export const useDocumentViewStatus = useDocuments;
export function useDocumentRecoveryCount() { return useDocuments().data.drafts?.length ?? 0; }
const label = { file: 'ファイル', folder: 'フォルダー', url: 'URL' };
function batchMessage(batch:DocumentBatch){const reused=batch.reused.length;return reused?`資料目録に登録済みの${reused}件は既存の資料を使用しました。${batch.registered.length-reused}件を新規登録しました。`:'';}

export function Documents({ context = null, items, themes, openItem, openTheme, readOnly = false }: { context?: DocumentContext | null; items: Item[]; themes: Theme[]; openItem: (id: string) => void; openTheme?: (id: string) => void; readOnly?: boolean }) {
  useSyncExternalStore(documentEditor.subscribe,documentEditor.getSnapshot);
  const state = useDocuments(), [view, setView] = useState(catalogView);
  const [adding, setAdding] = useState(false), [editing, setEditing] = useState<WorkspaceDocument>(), [usage, setUsage] = useState<DocumentUse>(), [removing, setRemoving] = useState<WorkspaceDocument>();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [dragging, setDragging] = useState(false);
  const [failures, setFailures] = useState<DocumentBatch['failed']>([]), [message, setMessage] = useState('');
  const [discarding, setDiscarding] = useState<DocumentDraft>();
  const table = useRef<HTMLDivElement>(null);
  const registrationKey = useRef(Symbol());
  useEffect(() => {
    const key = Symbol();
    if (failures.some(entry => entry.reference.trim())) registrationInputs.add(key);
    return () => { registrationInputs.delete(key); };
  }, [failures]);
  useEffect(()=>()=>{registrationInputs.delete(registrationKey.current);},[]);
  useEffect(() => { const key = Symbol(); if (busy) closeBlockers.add(key); return () => { closeBlockers.delete(key); }; }, [busy]);
  useEffect(() => { if (!loaded) void loadDocuments(); }, []);
  useEffect(() => { if (!context && state.loaded) setView(catalogView); }, [state.loaded]);
  useLayoutEffect(() => { if (!context && table.current) table.current.scrollTop = catalogView.scroll; }, [state.loaded]);
  useLayoutEffect(() => { if (!context && table.current) table.current.scrollTop = view.scroll; }, [view.query, view.kind, view.theme, view.sort]);
  const change = (patch: Partial<CatalogView>) => { patchCatalog(patch); setView(catalogView); };
  async function act(input: DocumentRequest) {
    setBusy(true); setError('');
    try { if (['use', 'detach', 'remove', 'reorder'].includes(input.action) && !(await flushDocumentEdits(edit => input.action === 'reorder' ? edit.action==='use'&&edit.context.kind===input.context.kind&&edit.context.id===input.context.id : 'id' in input&&edit.id===input.id&&(input.action!=='detach'||edit.action==='use'&&edit.context.kind===input.context.kind&&edit.context.id===input.context.id))).ready) throw new Error('未保存の資料入力を確認し、保存を再試行してください。'); const value = await request(input); if (input.action !== 'open' && input.action !== 'pick') await loadDocuments(); return value; }
    catch (error) { setError(error instanceof Error ? error.message : '処理できませんでした。再試行してください。'); throw error; }
    finally { setBusy(false); }
  }
  async function register(entries: DocumentRegistration[]) {
    if (!entries.length) return;
    try { const result = await act({ action: 'register', entries, context }) as DocumentBatch; setFailures(result.failed); setMessage(batchMessage(result)); setAdding(false); } catch { /* Inputs stay in the modal. */ }
  }
  const related = context ? documentUses(state.data, context, items) : state.data.uses;
  const selectedUses = (id: string) => related.filter(use => use.documentId === id);
  const relatedThemes = (uses: DocumentUse[]) => themes.filter(theme => uses.some(use => use.kind === 'theme' ? use.contextId === theme.id : items.some(item => item.id === use.contextId && item.themeId === theme.id)));
  let rows = state.data.documents.filter(doc => !context || selectedUses(doc.id).length);
  if (!context) {
    rows = selectDocuments(state.data, items, view);
  } else rows.sort((a, b) => {
    const order=context.kind==='theme'?state.data.themeOrders?.[context.id]:undefined;
    if(order){const ai=order.indexOf(a.id),bi=order.indexOf(b.id);if(ai!==bi)return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);}
    const aa = selectedUses(a.id), bb = selectedUses(b.id);
    const own = (uses: DocumentUse[]) => uses.find(use => use.kind === context.kind && use.contextId === context.id) ?? uses[0]!;
    return own(aa).position - own(bb).position || a.id.localeCompare(b.id);
  });
  const dragSource = useRef<string | undefined>(undefined);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean }>();
  async function reorder(source: string, target: string, after: boolean) {
    if (!context || source === target) return;
    if (!(await flushDocumentEdits(edit=>edit.action==='use'&&edit.context.kind===context.kind&&edit.context.id===context.id)).ready) { setError('未保存の入力を確認してください。'); return; }
    const peers = rows.map(doc=>{const uses=selectedUses(doc.id);return uses.find(use=>use.kind===context.kind&&use.contextId===context.id)??uses[0]!;});
    const ids = peers.map(use => use.documentId).filter(id => id !== source);
    if (!peers.some(use => use.documentId === source) || !ids.includes(target)) return;
    ids.splice(ids.indexOf(target) + Number(after), 0, source);
    try { await act({action:'reorder', context, ids, revisions:ids.map(id => peers.find(use => use.documentId === id)!.revision)}); } catch { /* Keep saved order and show retryable error. */ }
  }
  async function drop(files: File[]) {
    setBusy(true); setError(''); activeOperations++;
    try { const result = await window.workspace.dropDocuments(files, context); if (!result.ok) throw new Error(result.error.message); const batch = result.value as DocumentBatch; setFailures(batch.failed); setMessage(batchMessage(batch)); await loadDocuments(); }
    catch (error) { setError(error instanceof Error ? error.message : 'ドロップした資料を登録できませんでした。'); }
    finally { activeOperations--; setBusy(false); }
  }
  function recover(draft: DocumentDraft) {
    const doc = state.data.documents.find(doc => doc.id === draft.edit.id);
    if (!doc) { setError('資料が見つかりません。下書きは保持しています。内容を確認してから破棄できます。'); return; }
    if (draft.edit.action === 'use') memoEditors.get(draft.edit).restore(draft); else documentEditor.get(draft.edit).restore(draft);
    if (draft.edit.action === 'edit') setEditing(doc);
    else setUsage({ documentId: draft.edit.id, kind: draft.edit.context.kind, contextId: draft.edit.context.id, memo: draft.edit.memo, group: draft.edit.group, position: draft.edit.position, revision: draft.edit.revision });
  }
  async function detachFromPicker(id:string){
    if(!context)return;setBusy(true);setError('');
    try{
      if(!(await flushDocumentEdits(edit=>edit.action==='use'&&edit.id===id&&edit.context.kind===context.kind&&edit.context.id===context.id)).ready)throw Error('用途メモの保存を再試行してから解除してください。');
      const latest=await request({action:'list'}) as DocumentRecovery;
      const use=latest.uses.find(use=>use.documentId===id&&use.kind===context.kind&&use.contextId===context.id);
      if(use)await act({action:'detach',id,context,revision:use.revision});else await loadDocuments();
    }catch(error){setError(error instanceof Error?error.message:'関連を解除できませんでした。');}finally{setBusy(false);}
  }
  return <section className={`document-panel ${context ? 'context-documents' : 'catalog-page page-content'} ${dragging ? 'drop-active' : ''}`} aria-label={context ? '関連資料' : '資料目録'} onDragOver={event => { if (!readOnly && !busy && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (!readOnly && !busy) void drop(Array.from(event.dataTransfer.files)); }}>
    {!context && <header className="page-header"><div className="page-emblem"><Icon name="file" size={28} /></div><h1>資料目録</h1></header>}
    <div className="section-toolbar"><h2><Icon name="file" size={17} />{context ? '関連資料' : 'すべての資料'}<span className="count">{rows.length}</span></h2><button className={context ? 'text-button' : 'primary-button'} disabled={readOnly || busy || !state.loaded} onClick={() => { setError(''); setAdding(true); }}><Icon name="plus" size={16} />資料を追加</button></div>
    {documentEditor.getPending().filter(buffer=>buffer.status==='error').map(buffer=><div className="error-banner" role="alert" key={buffer.draft.edit.id}><span>{buffer.draft.edit.action==='edit'?buffer.draft.edit.name:''}：{buffer.error}</span><button onClick={()=>{const doc=state.data.documents.find(doc=>doc.id===buffer.draft.edit.id);if(doc)setEditing(doc);}}>入力を確認</button><button onClick={()=>void documentEditor.flush(edit=>edit.id===buffer.draft.edit.id)}>再試行</button></div>)}
    {state.loadError && <div className="error-banner" role="alert">{state.loadError}<button onClick={() => void loadDocuments()}>再読み込み</button></div>}
    {state.viewError && <div className="error-banner" role="alert">{state.viewError}<button onClick={() => void flushDocumentView()}>表示条件を再試行</button></div>}
    {!!state.data.drafts?.length && <div className="recovery-panel"><h3>資料の未保存の入力があります</h3>{state.data.drafts.map(draft => <div className="recovery-row" key={documentDraftKey(draft.edit)}><details><summary>{state.data.documents.find(doc => doc.id === draft.edit.id)?.name || draft.edit.id}</summary><pre className="document-error">{draft.edit.action === 'edit' ? `${draft.edit.name}\n${draft.edit.reference}\n${draft.edit.description}` : draft.edit.memo}</pre></details><button onClick={() => recover(draft)}>復旧する</button><button onClick={() => setDiscarding(draft)}>下書きを破棄</button></div>)}</div>}
    {error && <div className="error-banner document-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>閉じる</button></div>}
    {message && <p className="document-message" role="status">{message}<button className="icon-button" aria-label="通知を閉じる" onClick={() => setMessage('')}><Icon name="close" size={12} /></button></p>}
    {!!failures.length && <div className="document-failures" role="alert"><strong>{failures.length}件を登録できませんでした</strong>{failures.map((entry, index) => <div key={index}><input aria-label={`再試行する参照先${index + 1}`} value={entry.reference} onChange={event => setFailures(list => list.map((value, i) => i === index ? { ...value, reference: event.target.value, name: undefined } : value))} /><span>{entry.message}</span></div>)}<button disabled={busy} onClick={() => void register(failures.map(({ reference, kind, name }) => ({ reference, ...(kind ? { kind } : {}), ...(name ? { name } : {}) })))}>失敗した資料だけ再試行</button></div>}
    {!context && <div className="document-filters"><div className="document-search"><Icon name="search" size={16} /><input aria-label="資料を検索" placeholder="資料名・参照先・説明・用途メモを検索" value={view.query} onChange={event => change({ query: event.target.value, scroll: 0 })} /></div><select aria-label="資料の種類" value={view.kind} onChange={event => change({ kind: event.target.value, scroll: 0 })}>{Object.entries(documentKindFilters).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select><select aria-label="資料の関連テーマ" value={view.theme} onChange={event => change({ theme: event.target.value, scroll: 0 })}><option value="all">すべての関連</option><option value="none">未関連</option>{themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}{theme.archived ? '（アーカイブ）' : ''}</option>)}</select><select aria-label="資料の並べ替え" value={view.sort} onChange={event => change({ sort: event.target.value, scroll: 0 })}><option value="name-asc">名前 ↑</option><option value="name-desc">名前 ↓</option><option value="updated-desc">更新日時 ↓</option><option value="updated-asc">更新日時 ↑</option></select>{(view.query || view.kind !== 'all' || view.theme !== 'all') && <button className="text-button" onClick={() => change({ query: '', kind: 'all', theme: 'all', scroll: 0 })}>条件を解除</button>}</div>}
    <div ref={table} className="document-table-scroll" onScroll={event => { if (!context) patchCatalog({ scroll: event.currentTarget.scrollTop }); }}><table className="document-table"><thead><tr><th>資料名</th><th>種類</th>{!context && <th>参照先</th>}<th>{context?.kind === 'item' ? '用途メモ' : '関連テーマ / ページ'}</th><th aria-label="操作" /></tr></thead><tbody>{rows.map(doc => {
      const uses = selectedUses(doc.id), ownUse = context ? uses.find(use => use.kind === context.kind && use.contextId === context.id) : undefined;
      return <DocumentRows key={doc.id} doc={doc} uses={uses} ownUse={ownUse} context={context} items={items} themes={relatedThemes(uses)} selected={view.selected === doc.id} readOnly={readOnly || busy}
        sortable={!!context}
        open={() => { void (async () => { if ((await documentEditor.flush(edit => edit.id === doc.id)).ready) await act({ action: 'open', id: doc.id }); })().catch(() => {}); }}
        detail={() => { if (!context) change({selected:doc.id}); setError(''); setEditing(doc); }}
        openItem={id => { if (!context) change({selected:doc.id}); openItem(id); }} openTheme={openTheme}
        remove={() => setRemoving(doc)} detach={() => { if (ownUse) void act({ action:'detach',id:doc.id,context:context!,revision:ownUse.revision }).catch(()=>{}); }}
        startDrag={() => { dragSource.current=doc.id; }} endDrag={() => { dragSource.current=undefined; setDropTarget(undefined); }}
        canDrop={() => !!dragSource.current && dragSource.current!==doc.id}
        over={after => setDropTarget({id:doc.id,after})} drop={after => { const source=dragSource.current; dragSource.current=undefined; setDropTarget(undefined); if(source) void reorder(source,doc.id,after); }}
        dropSide={dropTarget?.id===doc.id ? dropTarget.after ? 'after':'before' : undefined}
        keyboardMove={direction => { const index=rows.findIndex(peer=>peer.id===doc.id); const target=rows[index+direction]; if(target) void reorder(doc.id,target.id,direction>0); }} />;
    })}</tbody></table>{state.loaded && !rows.length && <p className="quiet-empty">{context ? '関連する資料はありません。ファイルのドロップでも追加できます。' : view.query || view.kind !== 'all' || view.theme !== 'all' ? '条件に合う資料はありません' : '資料はまだありません。ファイルのドロップでも追加できます。'}</p>}</div>
    {adding && <AddDocuments context={context} data={state.data} items={items} themes={themes} onDirtyChange={dirty=>{if(dirty)registrationInputs.add(registrationKey.current);else registrationInputs.delete(registrationKey.current);}} choose={async kind => await request({ action: 'pick', kind }) as DocumentRegistration[]} busy={busy} error={error} close={() => { if (!busy) setAdding(false); }} register={register} attach={async id => { try { await act({ action: 'attach', id, context: context! }); } catch { /* Keep selection. */ } }} detach={detachFromPicker} />}
    {editing && <EditDocument key={editing.id} doc={editing} uses={state.data.uses.filter(use=>use.documentId===editing.id)} items={items} themes={themes} open={async () => { try { await act({action:'open',id:editing.id}); } catch {} }} openItem={openItem} openTheme={openTheme} error={error} busy={busy} close={() => { if (!busy) { setEditing(undefined); setError(''); } }} discard={() => { const buffer = documentEditor.getSnapshot(edit=>edit.id===editing.id); if (buffer?.dirty) setDiscarding(buffer.draft); }} />}
    {usage && <EditUse use={usage} error={error} busy={busy} close={() => { if (!busy) setUsage(undefined); }} discard={() => { const buffer = memoEditors.get(useEdit(usage)).getSnapshot(); if (buffer?.dirty) setDiscarding(buffer.draft); }} />}
    {discarding && <Modal title="資料の下書きを破棄しますか？" close={() => setDiscarding(undefined)}><p className="modal-description">この未保存の入力を破棄します。保存済みの資料情報と原本は保持します。</p><div className="modal-footer"><button onClick={() => setDiscarding(undefined)}>キャンセル</button><button onClick={async () => { try { if (discarding.edit.action === 'use' && memoEditors.get(discarding.edit).getSnapshot()?.draft.token === discarding.token) await memoEditors.get(discarding.edit).discard(); else if (documentEditor.get(discarding.edit).getSnapshot()?.draft.token === discarding.token) await documentEditor.get(discarding.edit).discard(); else { await request({ action: 'discard-edit', draft: discarding }); await loadDocuments(); } setDiscarding(undefined); setEditing(undefined); setUsage(undefined); } catch (error) { setError(error instanceof Error ? error.message : '破棄できませんでした。'); } }}>破棄する</button></div></Modal>}
    {removing && <Modal title="資料の登録を解除しますか？" close={() => { if (!busy) setRemoving(undefined); }}><p className="modal-description">「{removing.name}」の目録と{state.data.uses.filter(use => use.documentId === removing.id).length}件の関連付けを削除します。原本はそのまま残ります。</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="modal-footer"><button disabled={busy} onClick={() => setRemoving(undefined)}>キャンセル</button><button className="primary-button" disabled={busy} onClick={async () => { try { await act({ action: 'remove', id: removing.id, revision: removing.revision, linkCount: state.data.uses.filter(use => use.documentId === removing.id).length }); setRemoving(undefined); } catch { /* Keep confirmation. */ } }}>登録解除</button></div></Modal>}
  </section>;
}

function DocumentRows({doc,uses,ownUse,sortable,context,items,themes,selected,readOnly,detail,open,openItem,openTheme,remove,detach,startDrag,endDrag,canDrop,over,drop,dropSide,keyboardMove}: {
  sortable:boolean; doc:WorkspaceDocument; uses:DocumentUse[]; ownUse?:DocumentUse; context:DocumentContext|null; items:Item[]; themes:Theme[]; selected:boolean; readOnly:boolean;
  detail:()=>void; open:()=>void; openItem:(id:string)=>void; openTheme?: (id:string)=>void; remove:()=>void; detach:()=>void; startDrag:()=>void; endDrag:()=>void; canDrop:()=>boolean; over:(after:boolean)=>void; drop:(after:boolean)=>void; dropSide?:string; keyboardMove:(direction:number)=>void;
}) {
  return <tr data-document-id={doc.id} data-return-anchor={selected&&!context} className={dropSide ? `document-drop-${dropSide}` : ''}
    onClick={event=>{if(!(event.target as HTMLElement).closest('button,input,textarea,select,summary,details,a')) detail();}}
    onDragOver={event=>{if(sortable&&!readOnly&&canDrop()){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';over(event.clientY>event.currentTarget.getBoundingClientRect().top+event.currentTarget.clientHeight/2);}}}
    onDrop={event=>{if(sortable&&!readOnly&&canDrop()){event.preventDefault();event.stopPropagation();drop(event.clientY>event.currentTarget.getBoundingClientRect().top+event.currentTarget.clientHeight/2);}}}>
    <td><div className="document-title-line">{sortable&&<button className="document-drag-handle" disabled={readOnly} draggable={!readOnly} aria-label={`${doc.name}を並べ替え`} title="ドラッグで並べ替え（Alt+↑/↓）" onDragStart={event=>{event.stopPropagation();event.dataTransfer.setData('application/x-workspace-document',doc.id);event.dataTransfer.effectAllowed='move';startDrag();}} onDragEnd={endDrag} onClick={event=>event.stopPropagation()} onKeyDown={event=>{if(event.altKey&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();keyboardMove(event.key==='ArrowUp'?-1:1);}}}>⠿</button>}<button className="page-link document-name" aria-label={doc.name} title={doc.reference} onClick={open}><DocumentIcon doc={doc}/><span>{doc.name}</span></button></div></td>
    <td><span className="document-kind">{documentTypeLabels[documentType(doc)]}</span></td>{!context&&<td className="reference-cell" title={doc.reference}>{doc.reference}</td>}
    <td className="document-relations">{context?.kind==='item'&&ownUse ? <InlineMemo use={ownUse} name={doc.name} source={items.find(item=>item.id===ownUse.contextId)?.title||''} disabled={readOnly}/> : <RelatedNames themes={themes} items={items.filter(item=>uses.some(use=>use.kind==='item'&&use.contextId===item.id))} openItem={openItem} openTheme={openTheme}/>}</td>
    <td><details className="document-menu" onToggle={event=>{const menu=event.currentTarget;if(menu.open){const rect=menu.querySelector('summary')!.getBoundingClientRect();const panel=menu.querySelector('div')!;panel.style.left=`${Math.max(8,rect.right-210)}px`;panel.style.top=`${Math.max(8,Math.min(rect.bottom+4,window.innerHeight-panel.offsetHeight-10))}px`;}}}><summary aria-label={`${doc.name}の操作`}>•••</summary><div><button onClick={event=>{event.currentTarget.closest('details')!.open=false;detail();}}>資料の詳細</button>{ownUse&&<button disabled={readOnly} onClick={detach}>この関連を解除</button>}<button disabled={readOnly} onClick={event=>{event.currentTarget.closest('details')!.open=false;remove();}}>資料の登録解除</button></div></details></td>
  </tr>;
}
function RelatedNames({themes,items,openItem,openTheme}:{themes:Theme[];items:Item[];openItem:(id:string)=>void;openTheme?:(id:string)=>void}) {
  const ref=useRef<HTMLDivElement>(null); const [overflow,setOverflow]=useState(false);
  useLayoutEffect(()=>{const element=ref.current;if(!element)return;const update=()=>setOverflow(element.scrollWidth>element.clientWidth+1);update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();},[themes,items]);
  return <div className="related-name-container"><div ref={ref} className="related-name-strip">{themes.map(theme=><button className="text-button" key={theme.id} title={theme.name} onClick={()=>openTheme?.(theme.id)}><Icon name="folder" size={13}/><span>{theme.name}</span></button>)}{items.map(item=><button className="text-button" data-related-page={item.id} key={item.id} title={item.title} onClick={()=>openItem(item.id)}><Icon name="file" size={13}/><span>{item.title}</span></button>)}</div>{overflow&&<span className="related-overflow" aria-label="ほかの関連先は資料詳細で確認">…</span>}</div>;
}
function InlineMemo({ use, name, source, disabled, detail = false }: { use: DocumentUse; name: string; source: string; disabled: boolean; detail?: boolean }) {
  const editor = memoEditors.get(useEdit(use));
  const buffer = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const edit = buffer?.draft.edit;
  const memo = edit?.action === 'use' && (buffer?.dirty || edit.revision >= use.revision) ? edit.memo : use.memo;
  const change = (memo: string, composing = false) => { const current = editor.getSnapshot(); if (!current || !current.dirty && current.draft.edit.revision < use.revision) editor.begin(useEdit(use)); editor.change({ ...useEdit(use), memo }, composing); };
  return <div className="inline-document-memo">
    <textarea rows={1} wrap="off" id={memoInputId(use) + (detail ? "-detail" : "")} className="cell-input" aria-label={`${name}（${source}）の用途メモ`} title={memo || '用途メモを追加'} disabled={disabled} placeholder="用途メモを追加…" value={memo} onChange={event => change(event.target.value, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event => change(event.currentTarget.value)} onBlur={() => { void editor.save(); }} />
    {buffer?.status === 'error' && <div className="inline-memo-error" role="alert"><span>{buffer.error}</span><button className="text-button" onClick={() => void editor.save()}>再試行</button></div>}
  </div>;
}
function useDocumentForm(initial: DocumentEdit, editor = documentEditor.get(initial)) {
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  useEffect(() => { editor.begin(initial); }, []);
  const edit = state && documentDraftKey(state.draft.edit) === documentDraftKey(initial) ? state.draft.edit : initial;
  const change = (patch: Record<string, unknown>, composing = false) => editor.change({ ...edit, ...patch } as DocumentEdit, composing);
  return { state, edit, change };
}
function DocumentSaveStatus({ state }: { state: ReturnType<DocumentEditorPool['getSnapshot']> }) {
  const status=saveStatus({error:state?.status==='error'?state.error:undefined,saving:!!state?.dirty&&!state.hold&&state.status!=='error',draft:!!state?.dirty});
  if(!status.error)return null;
  return <span className={`fine-print ${status.error?'error-text':''}`} role="status"><Icon name={status.icon} size={12}/>{status.label}</span>;
}
function EditDocument({doc,uses,items,themes,open,openItem,openTheme,error,busy,close,discard}: {doc:WorkspaceDocument;uses:DocumentUse[];items:Item[];themes:Theme[];open:()=>Promise<void>;openItem:(id:string)=>void;openTheme?:(id:string)=>void;error:string;busy:boolean;close:()=>void;discard:()=>void}) {
  const {state,edit,change}=useDocumentForm({action:'edit',id:doc.id,revision:doc.revision,name:doc.name,reference:doc.reference,kind:doc.kind,description:doc.description});
  const memoState=useSyncExternalStore(memoEditors.subscribe,()=>memoEditors.getSnapshot(edit=>edit.id===doc.id));
  if(edit.action!=='edit') return null;
  const finish=async()=>{await flushDocumentEdits(edit=>edit.id===doc.id);close();};
  const navigate=async(action:()=>void)=>{await flushDocumentEdits(edit=>edit.id===doc.id);close();action();};
  const relatedItems=items.filter(item=>uses.some(use=>use.kind==='item'&&use.contextId===item.id));
  const themeIds=[...new Set([...uses.filter(use=>use.kind==='theme').map(use=>use.contextId),...relatedItems.map(item=>item.themeId)])];
  return <Modal title="資料の詳細" className="document-detail-dialog" close={()=>void finish()}>
    <div className="document-detail-properties"><label className="form-label">タイトル<input aria-label="資料のタイトル" className="document-detail-title" value={edit.name} disabled={busy} onChange={event=>change({name:event.target.value},(event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event=>change({name:event.currentTarget.value})}/></label>
    <label className="form-label">リンク<input aria-label="資料のリンク" value={edit.reference} disabled={busy} onChange={event=>change({reference:event.target.value},(event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event=>change({reference:event.currentTarget.value})}/></label>
    <button className="text-button" disabled={busy} onClick={async()=>{if((await documentEditor.flush(edit=>edit.id===doc.id)).ready) await open();}}><Icon name="link" size={14}/>原本を開く</button>
    <details className="document-extra-properties"><summary>説明・種類</summary><label className="form-label">説明<textarea id="document-description" rows={2} value={edit.description} disabled={busy} onChange={event=>change({description:event.target.value},(event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event=>change({description:event.currentTarget.value})}/></label><label className="form-label">種類<select value={edit.kind} disabled={busy} onChange={event=>change({kind:event.target.value})}>{Object.entries(label).map(([kind,name])=><option key={kind} value={kind}>{name}</option>)}</select></label></details></div>
    <section className="document-detail-relations"><h3>関連テーマ・ページ</h3>{!uses.length&&<p className="quiet-empty">関連先はありません</p>}{themeIds.map(themeId=>{
      const theme=themes.find(theme=>theme.id===themeId),direct=uses.find(use=>use.kind==='theme'&&use.contextId===themeId);
      const related=relatedItems.filter(item=>item.themeId===themeId);
      return <div className="document-detail-theme" key={themeId??'none'}><div className="document-detail-relation theme-relation"><button className="text-button" title={theme?.name} disabled={!theme||!openTheme} onClick={()=>void navigate(()=>{if(theme)openTheme?.(theme.id);})}><Icon name="folder" size={15}/><span>{theme?.name||'未所属'}</span></button>{direct&&<InlineMemo detail use={direct} name={doc.name} source={theme?.name||''} disabled={busy||!!theme?.archived}/>}</div>{related.map(item=>{const use=uses.find(use=>use.kind==='item'&&use.contextId===item.id)!;return <div className="document-detail-relation page-relation" key={item.id}><button className="text-button" title={item.title} onClick={()=>void navigate(()=>openItem(item.id))}><Icon name="file" size={14}/><span>{item.title}</span></button><InlineMemo detail use={use} name={doc.name} source={item.title} disabled={busy||item.archived||!!theme?.archived}/></div>;})}</div>;
    })}</section>
    {error&&<p className="form-error document-error" role="alert">{error}</p>}
    <div className="modal-footer"><DocumentSaveStatus state={state?.status==='error'?state:memoState??state}/>{state?.status==='error'&&<button onClick={discard}>未保存の入力を破棄</button>}{(state?.status==='error'||memoState?.status==='error')&&<button className="outline-button" disabled={busy} onClick={()=>void flushDocumentEdits(edit=>edit.id===doc.id)}>再試行</button>}<button className="primary-button" disabled={busy} onClick={()=>void finish()}>閉じる</button></div>
  </Modal>;
}
function EditUse({ use, error, busy, close, discard }: { use: DocumentUse; error: string; busy: boolean; close: () => void; discard: () => void }) {
  const editor = memoEditors.get(useEdit(use));
  const { state, edit, change } = useDocumentForm(useEdit(use), editor);
  if (edit.action !== 'use') return null;
  const finish = async () => { await editor.save(); close(); };
  return <Modal title="この関連先での使い方" close={() => void finish()}><form onSubmit={event => { event.preventDefault(); void finish(); }}><label className="form-label">用途メモ<textarea value={edit.memo} disabled={busy} rows={4} onChange={event => change({ memo: event.target.value }, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event => change({ memo: event.currentTarget.value })} /></label>{error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-footer"><DocumentSaveStatus state={state} />{state?.status === 'error' && <button type="button" onClick={discard}>未保存の入力を破棄</button>}<button type="button" disabled={busy} onClick={() => void finish()}>閉じる</button>{state?.status==='error'&&<button type="button" className="outline-button" disabled={busy} onClick={()=>void editor.save()}>再試行</button>}</div></form></Modal>;
}
