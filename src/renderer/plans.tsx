import { useRef,useState,useSyncExternalStore } from 'react';
import type { Item,Theme } from '../shared/model';
import { isSubmitKey,STATES } from '../shared/model';
import { emptyPlan } from '../shared/plans';
import type { PlanRow } from '../shared/plans';
import { Modal } from './components';
import { Icon } from './icons';
import { planStore } from './plan-store';

export function PlanRecovery(){const state=useSyncExternalStore(planStore.subscribe,planStore.getSnapshot);const [confirm,setConfirm]=useState(false);return <>
  {state.recovery&&<div className="recovery-panel"><span>計画の未保存の下書きがあります</span><button onClick={()=>planStore.restore()}>計画を復旧</button><button onClick={()=>setConfirm(true)}>破棄…</button></div>}
  {(state.error||state.viewError)&&<div className="error-banner" role="alert"><Icon name="alert"/><span>{state.error||state.viewError}</span><button onClick={()=>void (state.loaded?planStore.flush():planStore.load())}>計画を再試行</button></div>}
  {confirm&&<Modal title="計画の下書きを破棄しますか？" close={()=>setConfirm(false)}><p>保存済みの計画は保持します。</p><div className="modal-footer"><button onClick={()=>setConfirm(false)}>戻る</button><button onClick={()=>{void planStore.discardRecovery();setConfirm(false);}}>破棄する</button></div></Modal>}
</>;}

export {Plans} from './plan-timeline';

export function PlanPages({row,themes,items,close}:{row:PlanRow;themes:Theme[];items:Item[];close:()=>void}){
  const [query,setQuery]=useState(''),[theme,setTheme]=useState(row.themeId??'all'),[state,setState]=useState('all');
  const current=useSyncExternalStore(planStore.subscribe,planStore.getSnapshot).rows.find(r=>r.id===row.id)??row;
  return <Modal title="ページを関連付け" close={close}><div className="plan-tools"><input autoFocus aria-label="計画に関連付けるページを検索" placeholder="ページを検索" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="関連付けるページのテーマ" value={theme} onChange={e=>setTheme(e.target.value)}><option value="all">すべてのテーマ</option><option value="none">未所属</option>{themes.filter(t=>!t.archived).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><select aria-label="関連付けるページの状態" value={state} onChange={e=>setState(e.target.value)}><option value="all">すべての状態</option>{STATES.map(s=><option key={s}>{s}</option>)}</select></div><div className="plan-page-list">{items.filter(item=>!item.archived&&!themes.find(t=>t.id===item.themeId)?.archived&&(theme==='all'||item.themeId===(theme==='none'?null:theme))&&(state==='all'||item.state===state)&&item.title.includes(query)).map(item=><button key={item.id} aria-label={item.title} disabled={current.itemIds.includes(item.id)} onClick={()=>planStore.update(row.id,{itemIds:[...new Set([...(planStore.getSnapshot().rows.find(r=>r.id===row.id)?.itemIds??[]),item.id])]})}><Icon name="file" size={15}/><span>{item.title}</span><small>{item.state}</small><span>{current.itemIds.includes(item.id)?'追加済み':'追加'}</span></button>)}</div></Modal>;
}

export function AddToPlan({item,themes,close}:{item:Item;themes:Theme[];close:()=>void}){
  const state=useSyncExternalStore(planStore.subscribe,planStore.getSnapshot),[title,setTitle]=useState(item.title),[query,setQuery]=useState(''),[theme,setTheme]=useState(item.themeId??'all'),[busy,setBusy]=useState(false);
  const createdId=useRef<string|undefined>(undefined);
  const add=async(row:PlanRow)=>{setBusy(true);planStore.update(row.id,{itemIds:[...new Set([...row.itemIds,item.id])]});if((await planStore.flush()).ready)close();setBusy(false);};
  const create=async()=>{if(!title.trim()||busy)return;setBusy(true);if(createdId.current)planStore.update(createdId.current,{title:title.trim()});else{const row=emptyPlan(title.trim(),item.themeId,[item.id]);createdId.current=row.id;planStore.change([...state.rows,row]);}if((await planStore.flush()).ready)close();setBusy(false);};
  return <Modal title="計画に追加" close={close}><form onSubmit={e=>{e.preventDefault();void create();}}><label className="form-label">新しい計画行<input aria-label="ページから作る計画行名" autoFocus value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!isSubmitKey(e.nativeEvent))e.preventDefault();}}/></label><div className="modal-footer"><button disabled={busy||!title.trim()||!state.loaded||!!state.recovery}>作成して追加</button></div></form><input aria-label="追加先の計画行を検索" placeholder="登録済みの計画行を検索" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="追加先の計画テーマ" value={theme} onChange={e=>setTheme(e.target.value)}><option value="all">すべてのテーマ</option><option value="none">未所属</option>{themes.filter(t=>!t.archived).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><div className="plan-page-list">{state.rows.filter(row=>!themes.find(t=>t.id===row.themeId)?.archived&&(theme==='all'||row.themeId===(theme==='none'?null:theme))&&row.title.includes(query)).map(row=><button key={row.id} aria-label={row.title} disabled={busy||row.itemIds.includes(item.id)||!!state.recovery} onClick={()=>void add(row)}><span>{row.title}</span><small>{row.itemIds.includes(item.id)?'追加済み':'追加'}</small></button>)}</div></Modal>;
}
