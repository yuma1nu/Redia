import {DocumentIcon} from './document-icon';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SearchStore } from './search-store';
import type { SearchTarget } from '../shared/search';
import { Modal } from './components';
import { Icon } from './icons';
export function SearchDialog({close,open}:{close:()=>void;open:(target:SearchTarget)=>Promise<void>}) {
  const [store]=useState(()=>new SearchStore(window.workspace.search)),state=useSyncExternalStore(store.subscribe,store.getSnapshot);
  const [active,setActive]=useState(-1),[opening,setOpening]=useState(false),[error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{input.current?.focus();void store.load();return()=>store.cancel();},[store]);
  useEffect(()=>{setActive(-1);},[state.query,state.includeArchived]);
  useEffect(()=>{if(active>=0)document.getElementById(`search-result-${active}`)?.scrollIntoView({block:'nearest'});},[active]);
  async function choose(index:number){const result=state.data.results[index];if(!result||state.loading||opening)return;setOpening(true);setError('');try{await open(result);close();}catch(e){setError(e instanceof Error?e.message:'開けませんでした。');}finally{setOpening(false);}}
  return <Modal title="検索" className="search-dialog" close={()=>{if(!opening)close();}}><div className="global-search-input"><Icon name="search" size={18}/><input ref={input} autoFocus aria-label="ワークスペースを検索" placeholder="テーマ・ページ・資料を検索…" value={state.query} maxLength={1000} role="combobox" aria-controls="global-search-results" aria-expanded="true" aria-activedescendant={active>=0?`search-result-${active}`:undefined}
    onChange={event=>store.change({query:event.target.value})} onKeyDown={event=>{
      if(event.nativeEvent.isComposing||event.keyCode===229)return;
      if(event.ctrlKey&&event.key.toLowerCase()==='k'){event.preventDefault();input.current?.select();}
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!state.loading&&state.data.results.length)setActive(index=>event.key==='ArrowDown'?Math.min(index+1,state.data.results.length-1):index<0?state.data.results.length-1:Math.max(0,index-1));}
      if(event.key==='Enter'){event.preventDefault();void choose(Math.max(0,active));}
    }}/>{state.query&&<button className="icon-button" aria-label="横断検索をクリア" onClick={()=>store.change({query:''})}><Icon name="close" size={14}/></button>}</div>
    <div className="global-search-options"><span>{state.query.trim()?'検索結果':'最近開いた対象'}</span><label className="toggle"><input type="checkbox" checked={state.includeArchived} onChange={event=>store.change({includeArchived:event.target.checked})}/>アーカイブを含む</label></div>
    <div className="global-search-results" id="global-search-results" role="listbox" aria-label="検索結果" aria-busy={state.loading}>
      {state.loading?<p className="quiet-empty" role="status">検索中…</p>:state.error?<div className="form-error" role="alert">{state.error}<button onClick={()=>void store.load()}>検索を再試行</button></div>:!state.data.results.length?<p className="quiet-empty">{state.query.trim()?'一致する対象はありません':'最近開いた対象はありません'}</p>:state.data.results.map((result,index)=><button id={`search-result-${index}`} key={`${result.kind}:${result.id}`} role="option" aria-selected={active===index} className={`global-search-result${active===index?' keyboard-active':''}`} disabled={opening} onClick={()=>void choose(index)}>{result.kind==='document'?<DocumentIcon type={result.documentType} size={18}/>:<Icon name={result.kind==='theme'?'folder':'file'} size={18}/>} <span className="search-result-content"><strong>{result.title}</strong><small>{result.detail}{result.archived?' · アーカイブ':''}</small>{result.excerpt&&<span className="search-excerpt">{result.excerpt}</span>}</span></button>)}
    </div>
    {state.data.total>50&&!state.loading&&<p className="fine-print">{state.data.total}件のうち先頭50件を表示。検索語を追加して絞り込めます。</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <footer className="search-footer"><span>↑↓ 選択　Enter 開く　Esc 閉じる</span><span>原本本文・画像内の文字は検索しません</span></footer>
  </Modal>;
}
