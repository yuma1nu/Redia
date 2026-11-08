import {BackupSettings} from './backup-settings';
import { saveStatus } from '../shared/save-status';
import { SearchDialog } from './search-dialog';
import { Plans,PlanRecovery } from './plans';
import { planStore } from './plan-store';
import { bodyImages, flushBodyImages } from './body-images';
import type { SearchTarget } from '../shared/search';
import { Fragment, StrictMode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorStore } from './editor-store';
import { Icon } from './icons';
import { ItemDetail, Modal } from './components';
import { Documents, documentEditor, memoEditors, documentCloseReason, useDocumentViewStatus, flushDocumentEdits, flushDocumentView, loadDocuments, useDocumentRecoveryCount } from './documents';
import { Overview } from './overview';
import { ViewStore } from './view-store';
import { localToday } from '../shared/lists';
import { draftKey, isSubmitKey } from '../shared/model';
import type { Draft, DraftRef, ItemFields, NewItemFields, ThemeFields } from '../shared/model';
import './style.css';
import appIcon from '../../assets/app-icon.png';

type Route = { type: 'home' | 'archive' } | { type: 'documents' } | {type:'plans';themeId?:string} | { type: 'theme'; id: string } | { type: 'item'; id: string } | { type: 'settings' };
const routeKey = (route: Route) => route.type + ('id' in route ? route.id : '');
const store = new EditorStore(window.workspace);
const views = new ViewStore(window.workspace);
const listKey = (route: Route) => route.type === 'theme' ? `theme:${route.id}` : ['home', 'search', 'archive'].includes(route.type) ? route.type : undefined;
function App() {
  const planState=useSyncExternalStore(planStore.subscribe,planStore.getSnapshot);
  const [searching,setSearching]=useState(false);
  const pendingImages=useSyncExternalStore(bodyImages.subscribe,bodyImages.getSnapshot);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.ctrlKey&&event.key.toLowerCase()==='k'&&!event.isComposing){event.preventDefault();if(!document.querySelector('dialog[open]'))setSearching(true);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const documentView=useDocumentViewStatus();
  const documentRecoveryCount = useDocumentRecoveryCount();
  const commonDocumentBuffer = useSyncExternalStore(documentEditor.subscribe, documentEditor.getSnapshot);
  const memoBuffer = useSyncExternalStore(memoEditors.subscribe, memoEditors.getSnapshot);
  const documentBuffer = commonDocumentBuffer?.status === 'error' ? commonDocumentBuffer : memoBuffer ?? commonDocumentBuffer;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const viewState = useSyncExternalStore(views.subscribe, views.getSnapshot);
  const [today, setToday] = useState(() => localToday());
  const [route, setRoute] = useState<Route>({ type: 'home' });
  const history = useRef<Route[]>([]), scrolls = useRef(new Map<string, number>());
  const content = useRef<HTMLElement>(null);
  const [form, setForm] = useState<DraftRef>(), [submitting, setSubmitting] = useState(false);
  const createInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState(''), [backupBusy, setBackupBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => void }>();
  useEffect(() => { void planStore.load(); void loadDocuments(); void store.load().then(() => views.initialize(store.getSnapshot().data.views)); }, []);
  useEffect(() => { const update = () => setToday(localToday()); const timer = setInterval(update, 30000); window.addEventListener('focus', update); return () => { clearInterval(timer); window.removeEventListener('focus', update); }; }, []);
  useEffect(() => { if (form && !submitting) createInput.current?.focus(); }, [form?.id, submitting]);
  useEffect(() => window.workspace.onCloseRequested(requestId => {
    const respondReason=()=>{const reason=documentCloseReason();if(!reason)return false;window.workspace.respondToClose({requestId,ready:false,draftsSafe:false,reason});return true;};
    if(documentCloseReason()==='operation'&&respondReason())return;
    void (async()=>{const images=await flushBodyImages();const [result,savedView,savedDocuments,editedDocuments,plans]=await Promise.all([store.flush(),views.flush(),flushDocumentView(),flushDocumentEdits(),planStore.flush()]);
      const ready=images.ready&&result.ready&&savedView&&savedDocuments&&editedDocuments.ready&&plans.ready;
      const draftsSafe=images.draftsSafe&&result.draftsSafe&&savedView&&savedDocuments&&editedDocuments.draftsSafe&&plans.draftsSafe;
      if(!ready){window.workspace.respondToClose({requestId,ready:false,draftsSafe:draftsSafe&&documentCloseReason()!=='registration'});return;}
      if(respondReason())return;
      let backupFailed=false;try{await Promise.race([window.workspace.createBackup().then(result=>{if(!result.ok)throw Error(result.error.message);}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Backup timeout')),6000))]);}catch{backupFailed=true;}
      window.workspace.respondToClose({requestId,ready:true,draftsSafe:true,backupFailed});
    })().catch(()=>window.workspace.respondToClose({requestId,ready:false,draftsSafe:false}));
  }), []);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); } }, [notice]);
  useLayoutEffect(() => { const key = listKey(route); if (content.current) content.current.scrollTop = key ? views.get(key).mainScrollTop : scrolls.current.get(routeKey(route)) ?? 0; }, [route, state.loading, viewState.initialized]);
  function navigate(next: Route, back = false) {
    const key = listKey(route);
    if (key) views.patch(key, { mainScrollTop: content.current?.scrollTop ?? 0 });
    else scrolls.current.set(routeKey(route), content.current?.scrollTop ?? 0);
    if (!back) history.current.push(route);
    setRoute(next);
  }
  const remember=(target:SearchTarget)=>{void window.workspace.search({action:'remember',target});};
  const openItem = (id: string) => { remember({kind:'item',id});const key = listKey(route); if (key) views.patch(key, { selectedId: id }); navigate({ type: 'item', id }); };
  const openTheme = (id: string) => {remember({kind:'theme',id});navigate({ type: 'theme', id });};
  async function openSearchResult(target:SearchTarget){if(target.kind==='item')openItem(target.id);else if(target.kind==='theme')openTheme(target.id);else {if(!(await documentEditor.flush(edit=>edit.id===target.id)).ready)throw Error('資料の保存できていない入力を確認してください。');const result=await window.workspace.documents({action:'open',id:target.id});if(!result.ok)throw Error(result.error.message);remember(target);}}
  function openCreate(themeId: string | null = null, originId: string | null = null) { setForm(store.create('new-item', themeId, originId)); }
  const items = state.data.items.map(item => ({ ...item, ...(state.buffers[`item:${item.id}`]?.fields as ItemFields | undefined) }));
  const activeTheme = route.type === 'theme' ? state.data.themes.find(theme => theme.id === route.id) : undefined;
  const activeItem = route.type === 'item' ? items.find(item => item.id === route.id) : undefined;
  const breadcrumbTheme = activeTheme ?? state.data.themes.find(theme => theme.id === activeItem?.themeId);
  const themeLabel = breadcrumbTheme
    ? (state.buffers[`theme:${breadcrumbTheme.id}`]?.fields as ThemeFields | undefined)?.name || breadcrumbTheme.name
    : '未所属';
  const breadcrumbs: { label: string; action?: () => void }[] = [
    { label: 'ワークスペース', action: () => navigate({ type: 'home' }) },
    ...(activeItem ? [
      { label: themeLabel, action: breadcrumbTheme ? () => openTheme(breadcrumbTheme.id) : undefined },
      { label: activeItem.title || '無題のページ' },
    ] : [{ label: activeTheme ? themeLabel : route.type === 'plans' ? '計画' : route.type === 'documents' ? '資料目録' : route.type === 'settings' ? '設定' : route.type === 'archive' ? 'アーカイブ' : 'HOME' }]),
  ];
  const pending = Object.values(state.buffers).filter(buffer => buffer.dirty);
  const failed = pending.filter(buffer => buffer.status === 'error');
  const saving = pending.some(buffer => buffer.status === 'saving' || (buffer.status === 'staging' && (!buffer.safe || !buffer.ref.kind.startsWith('new-')))) || !!documentBuffer?.dirty && !documentBuffer.hold && documentBuffer.status !== 'error';
  const pendingCreates = pending.filter(buffer => buffer.ref.kind.startsWith('new-') && buffer.ref.id !== form?.id);
  const formBuffer = form ? store.buffer(form) : undefined;
  const formFields = formBuffer?.fields as NewItemFields | { name: string } | undefined;
  const isRelatedCreate = formFields && 'originId' in formFields && !!formFields.originId;
  async function submitForm() {
    if (!form || !formFields || submitting || !('title' in formFields ? formFields.title : formFields.name).trim()) return;
    setSubmitting(true);
    if (isRelatedCreate && formFields && 'originId' in formFields && formFields.originId) {
      if (!await store.save({ kind: 'item', id: formFields.originId })) {
        setNotice('元ページの変更を保存できていません。入力を確認して再試行してください。');
        setSubmitting(false);
        return;
      }
    }
    const saved = await store.save(form);
    setSubmitting(false);
    if (saved) {
      setNotice(form.kind === 'new-theme' ? 'テーマを作成しました' : 'ページを作成しました');
      setForm(undefined);
    }
  }
  function recover(draft: Draft) {
    store.restore(draft);
    if (draft.ref.kind.startsWith('new-')) setForm(draft.ref);
    else navigate({ type: draft.ref.kind === 'item' ? 'item' : 'theme', id: draft.ref.id });
  }
  async function prepareRestore(){
    if(documentCloseReason())return false;
    const images=await flushBodyImages();const [a,b,c,d,e]=await Promise.all([store.flush(),views.flush(),flushDocumentView(),flushDocumentEdits(),planStore.flush()]);
    return images.draftsSafe&&a.draftsSafe&&b&&c&&d.draftsSafe&&e.draftsSafe;
  }
  async function backup() {
    setBackupBusy(true);
    try {
      if(!(await flushBodyImages()).draftsSafe){setNotice('保存できていない画像があります。ページで再試行してください。');return;}
      const flush = await store.flush();
      if (!flush.draftsSafe || !(await planStore.flush()).draftsSafe || !(await flushDocumentEdits()).draftsSafe || !await views.flush() || !await flushDocumentView()) { setNotice('下書きと表示条件を保存できていません。保存を再試行してください。'); return; }
      const result = await window.workspace.createBackup();
      setNotice(result.ok ? '' : result.error.message);
    } catch { setNotice('バックアップを作成できませんでした。再試行してください。'); }
    finally { setBackupBusy(false); }
  }
  useEffect(()=>{const timer=setInterval(()=>{if(!documentCloseReason())void backup();},30*60*1000);return()=>clearInterval(timer);},[]);
  async function performArchive(kind: 'item' | 'theme', id: string, archived: boolean) {
    const current=store.getSnapshot();
    const imageScope=new Set(kind==='item'?[id]:current.data.items.filter(item=>{const fields=current.buffers[`item:${item.id}`]?.fields as ItemFields|undefined;return (fields?fields.themeId:item.themeId)===id;}).map(item=>item.id));
    if(!(await flushBodyImages(imageScope)).ready){setNotice('保存できていない画像をページで確認してください。');return;}
    const flushed = await store.flush();
    const sourceIds=new Set(store.getSnapshot().data.items.filter(item=>item.themeId===id).map(item=>item.id));
    const documents = await flushDocumentEdits(edit=>edit.action==='use'&&(edit.context.kind===kind&&edit.context.id===id||kind==='theme'&&edit.context.kind==='item'&&sourceIds.has(edit.context.id)));
    if (!flushed.ready || !documents.ready || archived && !(await planStore.flush()).ready) { setNotice('未保存の入力を確認し、保存を再試行してください。'); return; }
    const entity = kind === 'item' ? store.getSnapshot().data.items.find(item => item.id === id) : store.getSnapshot().data.themes.find(theme => theme.id === id);
    if (!entity) return;
    try {
      const result = await window.workspace.setArchived({ kind, id, archived, baseRevision: entity.revision });
      if (result.ok) { store.apply(result.value); setNotice(archived ? 'アーカイブしました' : '復元しました'); }
      else setNotice(result.error.message);
    } catch { setNotice('アーカイブの変更を保存できませんでした。再試行してください。'); }
  }
  function archive(kind: 'item' | 'theme', id: string, archived: boolean) {
    if (!archived) { void performArchive(kind, id, false); return; }
    setConfirm({ title: kind === 'theme' ? 'テーマをアーカイブしますか？' : 'ページをアーカイブしますか？', message: kind === 'theme' ? '配下のページは通常の一覧から非表示になります。各ページの状態と個別のアーカイブは保持し、設定から復元できます。' : '通常の一覧から非表示にします。本文・状態・関連は保持し、設定から復元できます。', action: () => { void performArchive(kind, id, true); } });
  }
  const viewError = Object.values(viewState.errors)[0];
  const statusInput=({loading:state.loading,error:planState.error||planState.viewError?planState.error||planState.viewError:pendingImages.some(image=>image.error)?'画像の保存に失敗しました':state.error|| (failed.length?'保存できていない入力があります':documentBuffer?.status==='error'?'資料の保存に失敗しました':viewError||documentView.viewError?'表示設定の保存に失敗しました':undefined),saving:planState.viewDirty&&!planState.viewError||planState.dirty&&!planState.error||pendingImages.some(image=>!!image.working)||saving||viewState.saving||documentView.viewPending,draft:!!documentBuffer?.dirty||pending.some(buffer=>buffer.ref.kind.startsWith('new-'))});
  const statusPending=statusInput.saving;
  const status=saveStatus(statusInput);
  return <div className="workspace" aria-busy={!status.error&&(state.loading||!planState.loaded||!documentView.loaded||!!statusPending)}><aside className="sidebar" aria-label="ナビゲーション">
    <div className="brand"><img className="brand-mark" src={appIcon} alt=""/><span>Redia</span></div>
    <nav><button aria-label="検索" aria-haspopup="dialog" onClick={() => setSearching(true)}><Icon name="search" /><span>検索</span><kbd>Ctrl K</kbd></button><button aria-current={route.type === 'home' ? 'page' : undefined} onClick={() => navigate({ type: 'home' })}><Icon name="home" /><span>HOME</span></button>
      <div className="nav-heading"><span>テーマ</span><button className="icon-button" disabled={state.loading || !!state.error} aria-label="テーマを作成" title="テーマを作成" onClick={() => setForm(store.create('new-theme'))}><Icon name="plus" size={16} /></button></div>
      <div className="theme-nav">{state.data.themes.filter(theme => !theme.archived).map(theme => <button key={theme.id} aria-current={route.type === 'theme' && route.id === theme.id ? 'page' : undefined} onClick={() => openTheme(theme.id)}><Icon name="folder" size={17} /><span>{theme.name}</span></button>)}{!state.data.themes.some(theme => !theme.archived) && <p className="nav-empty">テーマなし</p>}</div>
      <button aria-current={route.type === 'documents' ? 'page' : undefined} onClick={() => navigate({ type: 'documents' })}><Icon name="file" /><span>資料目録</span></button><button aria-current={route.type === 'plans' ? 'page' : undefined} onClick={() => navigate({type:'plans',themeId:activeTheme?.id})}><Icon name="plan" /><span>計画</span></button></nav>
    <div className="sidebar-bottom"><button aria-current={route.type === 'settings' ? 'page' : undefined} onClick={() => navigate({ type: 'settings' })}><Icon name="settings" /><span>設定</span></button></div>
  </aside><div className="main-layout"><div className="topbar"><div className="breadcrumb" role="navigation" aria-label="パンくず">
      {route.type !== 'home' && <button className="icon-button" aria-label="戻る" onClick={() => navigate(history.current.pop() ?? { type: 'home' }, true)}><Icon name="arrow" size={17} /></button>}
      {breadcrumbs.map((crumb, index) => <Fragment key={index}>
        {index > 0 && <Icon name="chevron" size={12} />}
        {crumb.action ? <button className="breadcrumb-link" title={crumb.label} onClick={crumb.action}>{crumb.label}</button> : <span title={crumb.label} aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>}
      </Fragment>)}
    </div>{status.error&&<span className={`save-status ${status.error?'error-text':''}`} role="status"><Icon name={status.icon} size={14}/>{status.label}</span>}</div>
    <main ref={content} onScroll={event => { const key = listKey(route); if (key) views.patch(key, { mainScrollTop: event.currentTarget.scrollTop }); }}>
      <PlanRecovery/>
      {pendingImages.some(image=>image.error)&&<div className="error-banner" role="alert"><Icon name="alert"/><span>保存できていない画像を保持しています。ページで再試行してください。</span>{[...new Set(pendingImages.filter(image=>image.error).map(image=>image.itemId))].map(id=><button key={id} onClick={()=>openItem(id)}>ページで確認</button>)}</div>}
      {state.error && <div className="error-banner" role="alert"><Icon name="alert" /><span>{state.error}</span><button onClick={() => void store.load()}>再読み込み</button></div>}
      {!!documentRecoveryCount && route.type !== 'documents' && <div className="recovery-panel"><span>資料の未保存の入力が{documentRecoveryCount}件あります</span><button onClick={() => navigate({ type: 'documents' })}>資料目録で復旧</button></div>}
      {!!state.recovery.length && <section className="recovery-panel"><h2><Icon name="backup" />前回の未保存の入力があります</h2><p>内容を復旧して、作業を続けられます。</p>{state.recovery.map(draft => <div className="recovery-row" key={draftKey(draft.ref)}><span>{'title' in draft.fields ? draft.fields.title || '無題のページ' : draft.fields.name || '無題のテーマ'}</span><button onClick={() => recover(draft)}>復旧する</button><button className="muted-button" onClick={() => setConfirm({ title: '下書きを破棄しますか？', message: 'この未保存の入力を削除します。保存済みのページは変わりません。', action: () => { void store.discard(draft.ref, draft.token); } })}>破棄</button></div>)}</section>}
      {!!failed.length && <div className="error-banner" role="alert"><Icon name="alert" /><span>{failed[0].error}</span><button onClick={() => void Promise.all([store.flush(), views.flush()])}>再試行</button>{failed[0].conflict && <button onClick={() => setConfirm({ title: '現在の入力で保存しますか？', message: '保存済みの変更を、現在画面に残っている入力で置き換えます。', action: () => { void store.rebase(failed[0].ref); } })}>この入力を保存</button>}</div>}
      {documentBuffer?.status === 'error' && <div className="error-banner" role="alert"><span>{documentBuffer.error}</span><button onClick={() => void flushDocumentEdits()}>資料入力の保存を再試行</button><button onClick={() => navigate({type:'documents'})}>資料目録で確認</button></div>}
      {documentView.viewError&&route.type!=='documents'&&<div className="error-banner" role="alert"><span>{documentView.viewError}</span><button onClick={()=>void flushDocumentView()}>資料一覧の表示設定を再試行</button></div>}
      {viewError && <div className="error-banner" role="alert"><Icon name="alert" /><span>{viewError}</span><button onClick={() => void views.flush()}>表示設定を再試行</button></div>}
      {state.loading || !viewState.initialized ? <div className="loading-state">ワークスペースを読み込んでいます…</div> : state.error ? <div className="loading-state">読み込みを完了するまで編集できません。上の案内から再読み込みしてください。</div> : route.type === 'documents' ? <Documents items={items} themes={state.data.themes} openItem={openItem} openTheme={openTheme} /> : route.type === 'plans' ? <Plans key={route.themeId??'all'} themes={state.data.themes} items={items} today={today} initialTheme={route.themeId} openItem={openItem}/> : route.type === 'home' || route.type === 'theme' || route.type === 'archive' ? <Overview scope={route} store={store} views={views} items={items} today={today} open={openItem} openTheme={openTheme} create={openCreate} notify={setNotice} archive={archive}>
      {!!pendingCreates.length && <div className="pending-creates"><h3>作成途中の下書き</h3>{pendingCreates.map(buffer => <button key={buffer.ref.id} className="text-button" onClick={() => setForm(buffer.ref)}><Icon name="file" size={15} />{'title' in buffer.fields ? buffer.fields.title || '無題のページ' : buffer.fields.name || '無題のテーマ'}</button>)}</div>}
      {activeTheme && <Documents key={activeTheme.id} context={{ kind: 'theme', id: activeTheme.id }} items={items} themes={state.data.themes} openItem={openItem} openTheme={openTheme} readOnly={activeTheme.archived} />}
      </Overview> : activeItem ? <ItemDetail key={activeItem.id} item={activeItem} items={items} store={store} open={openItem} openTheme={openTheme} notify={setNotice} archive={archive} /> : route.type === 'settings' ? <div className="settings-page page-content"><header className="page-header"><div className="page-emblem"><Icon name="settings" size={30} /></div><h1>設定</h1></header><BackupSettings backup={backup} busy={backupBusy} prepare={prepareRestore}/><section className="settings-section"><h2><Icon name="archive" />アーカイブ</h2><button className="outline-button" onClick={() => navigate({ type: 'archive' })}>アーカイブを管理</button></section></div> : <div className="empty-list">ページが見つかりません。</div>}
    </main></div>
    {searching&&<SearchDialog close={()=>setSearching(false)} open={openSearchResult}/>}
    {notice && <div className="toast" role="status">{notice}</div>}
    {form && formBuffer && <Modal title={form.kind === 'new-theme' ? '新しいテーマ' : '新しいページ'} close={() => { if (!submitting) setForm(undefined); }}><form onSubmit={event => { event.preventDefault(); void submitForm(); }}><label className="form-label" htmlFor="create-title">{form.kind === 'new-theme' ? 'テーマ名' : 'タイトル'}</label><input id="create-title" ref={createInput} autoFocus disabled={submitting} autoComplete="off" placeholder={form.kind === 'new-theme' ? 'テーマの名前' : '何に取り組みますか？'} value={'title' in formBuffer.fields ? formBuffer.fields.title : formBuffer.fields.name}
      onChange={event => store.edit(form, form.kind === 'new-theme' ? { name: event.target.value } : { title: event.target.value }, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event => store.edit(form, form.kind === 'new-theme' ? { name: event.currentTarget.value } : { title: event.currentTarget.value })}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (isSubmitKey(event.nativeEvent)) void submitForm(); } }} />{formBuffer.error && <p className="form-error" role="alert">{formBuffer.error}</p>}<div className="modal-footer"><button type="button" className="muted-button" disabled={submitting} onClick={() => setForm(undefined)}>閉じる</button><button className="primary-button" type="submit" disabled={submitting || !('title' in formBuffer.fields ? formBuffer.fields.title : formBuffer.fields.name).trim()}>{submitting ? '作成中…' : '作成する'}</button></div></form></Modal>}
    {confirm && <Modal title={confirm.title} close={() => setConfirm(undefined)}><p className="modal-description">{confirm.message}</p><div className="modal-footer"><button className="muted-button" onClick={() => setConfirm(undefined)}>キャンセル</button><button className="primary-button" onClick={() => { confirm.action(); setConfirm(undefined); }}>実行する</button></div></Modal>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
