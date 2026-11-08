import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import type { DocumentContext, DocumentRegistration, DocumentSnapshot } from '../shared/documents';
import type { Item, Theme } from '../shared/model';
import { selectDocuments } from '../shared/document-list';
import { Modal } from './components';
import { Icon } from './icons';
import { readClipboardDocuments } from './document-paste';
import { clipboardUrl,documentEntries,registrationNameKey,existingReferenceKey } from '../shared/document-paste';
import {documentKindFilters,documentType,documentTypeLabels,referenceTitle} from '../shared/document-type';
import {DocumentIcon} from './document-icon';

export function AddDocuments({ context, data, items, themes, busy, error, close, register, attach, detach, choose, onDirtyChange }: {
  context: DocumentContext | null; data: DocumentSnapshot; items: Item[]; themes: Theme[]; busy: boolean; error: string;
  close: () => void; register: (entries: DocumentRegistration[]) => Promise<void>; attach: (id: string) => Promise<void>;
  detach: (id:string)=>Promise<void>;
  onDirtyChange?: (dirty:boolean)=>void;
  choose: (kind: 'file' | 'folder') => Promise<DocumentRegistration[]>;
}) {
  const [references, setReferences] = useState(''), [pickError, setPickError] = useState(''), [picking, setPicking] = useState(false);
  const [view, setView] = useState(() => ({ query: '', kind: 'all', theme: context?.kind === 'item' ? items.find(item => item.id === context.id)?.themeId ?? 'all' : 'all', sort: 'name-asc' }));
  useEffect(()=>{onDirtyChange?.(!!references.trim());return()=>onDirtyChange?.(false);},[references]);
  const list = useRef<HTMLDivElement>(null);
  const names=useRef(new Map<string,string>());
  const [,refreshNames]=useState(0);
  const entries=documentEntries(references,names.current);
  const existingByReference=new Map(data.documents.map(doc=>[doc.normalized,doc]));
  function paste(event:ClipboardEvent<HTMLTextAreaElement>){
    if(disabled)return;
    const plain=event.clipboardData.getData('text/plain'),links=readClipboardDocuments(event.clipboardData.getData('text/html'),plain,event.currentTarget.ownerDocument);
    if(!links)return;
    for(const link of links){const url=clipboardUrl(link.reference);if(url&&link.name){names.current.delete(url);names.current.set(url,link.name);}}
    while(names.current.size>1000)names.current.delete(names.current.keys().next().value!);
    refreshNames(version=>version+1);
    const text=links.map(link=>link.reference).join('\n');
    if(text===plain)return;
    event.preventDefault();
    const field=event.currentTarget;
    // Chromium's text insertion preserves the textarea's native undo history.
    if(field.ownerDocument.execCommand('insertText',false,text)){setReferences(field.value);return;}
    const start=field.selectionStart;field.setRangeText(text,start,field.selectionEnd,'end');setReferences(field.value);
  }
  const disabled = busy || picking;
  const rows = selectDocuments(data, items, view);
  const attached = new Set(data.uses.filter(use => use.kind === context?.kind && use.contextId === context.id).map(use => use.documentId));
  function filter(patch: Partial<typeof view>) { setView(current => ({ ...current, ...patch })); if (list.current) list.current.scrollTop = 0; }
  async function pick(kind: 'file' | 'folder') {
    setPicking(true); setPickError('');
    try { await register(await choose(kind)); }
    catch (error) { setPickError(error instanceof Error ? error.message : '選択できませんでした。'); }
    finally { setPicking(false); }
  }
  return <Modal title="資料を追加" className={context ? 'document-picker-dialog' : undefined} close={() => { if (!disabled) close(); }}>
    <section className="document-register-area" aria-label="新しい資料を登録">
      {context && <h3>新規登録</h3>}
      <div className="document-pick-actions"><button className="outline-button" disabled={disabled} onClick={() => void pick('file')}><Icon name="file" size={16} />ファイルを選択</button><button className="outline-button" disabled={disabled} onClick={() => void pick('folder')}><Icon name="folder" size={16} />フォルダーを選択</button></div>
      <label className="form-label" htmlFor="document-references">パス / URL（1行に1件）</label>
      <div className={context ? 'document-reference-entry' : ''}><textarea id="document-references" autoFocus disabled={disabled} rows={context ? 1 : 5} value={references} onPaste={paste} onChange={event => setReferences(event.target.value)} placeholder="参照先を貼り付け" />{context && <button className="outline-button" disabled={disabled || !references.trim()} onClick={() => void register(entries)}><Icon name="plus" size={15} />登録する</button>}</div>
      {!!entries.length&&<div className="document-registration-titles">{entries.map((entry,index)=>{
        const key=registrationNameKey(entry.reference),identity=existingReferenceKey(entry.reference),existing=identity?existingByReference.get(identity):undefined;
        const name=existing?.name??names.current.get(key)??referenceTitle(entry.reference);
        return <div className="document-registration-title" key={index}>
          {entries.length>1&&<p className="document-reference" title={entry.reference}>{entry.reference}</p>}
          <label className="form-label">タイトル<div className="document-registration-title-field"><DocumentIcon doc={{kind:clipboardUrl(entry.reference)?'url':'file',reference:entry.reference,name}}/><input aria-label={`登録する資料のタイトル${index+1}`} value={name} disabled={disabled} readOnly={!!existing} maxLength={512} onChange={event=>{names.current.set(key,event.target.value);while(names.current.size>1000)names.current.delete(names.current.keys().next().value!);refreshNames(version=>version+1);}}/></div></label>
          {existing&&<p className="document-existing-message" role="status">資料目録に登録済みです。既存の資料「{existing.name}」を使用します。</p>}
        </div>;
      })}</div>}
    </section>
    {context && <section className="document-choose-area" aria-label="登録済みの資料から選択"><h3>登録済みの資料<span className="count">{rows.length}</span></h3>
      <div className="document-filters"><div className="document-search"><Icon name="search" size={16} /><input aria-label="追加する資料を検索" placeholder="資料名・参照先・説明・用途メモを検索" value={view.query} onChange={event => filter({ query: event.target.value })} /></div>
        <select aria-label="追加する資料の種類" value={view.kind} onChange={event => filter({ kind: event.target.value })}>{Object.entries(documentKindFilters).map(([kind, name]) => <option key={kind} value={kind}>{name}</option>)}</select>
        <select aria-label="追加する資料の関連テーマ" value={view.theme} onChange={event => filter({ theme: event.target.value })}><option value="all">すべての関連</option><option value="none">未関連</option>{themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}{theme.archived ? '（アーカイブ）' : ''}</option>)}</select>
        <select aria-label="追加する資料の並べ替え" value={view.sort} onChange={event => filter({ sort: event.target.value })}><option value="name-asc">名前 ↑</option><option value="name-desc">名前 ↓</option><option value="updated-desc">更新日時 ↓</option><option value="updated-asc">更新日時 ↑</option></select>
        {(view.query || view.kind !== 'all' || view.theme !== 'all') && <button className="text-button" onClick={() => filter({ query: '', kind: 'all', theme: 'all' })}>条件を解除</button>}
      </div>
      <div ref={list} className="document-picker-list"><table className="document-table"><thead><tr><th>資料名 / 参照先</th><th>種類</th><th>関連テーマ</th><th>操作</th></tr></thead><tbody>{rows.map(doc => {
        const uses = data.uses.filter(use => use.documentId === doc.id);
        const relatedThemes = themes.filter(theme => uses.some(use => use.kind === 'theme' ? use.contextId === theme.id : items.some(item => item.id === use.contextId && item.themeId === theme.id)));
        const linked=attached.has(doc.id);
        return <tr key={doc.id} data-picker-document={doc.id}><td><div className="document-picker-name"><DocumentIcon doc={doc} size={16}/><span>{doc.name}</span></div><p className="document-reference" title={doc.reference}>{doc.reference}</p>{doc.description && <p className="document-description">{doc.description}</p>}</td><td><span className="document-kind">{documentTypeLabels[documentType(doc)]}</span></td><td className="document-description">{relatedThemes.map(theme => theme.name).join('、') || '—'}</td><td><button className="text-button" aria-label={`${doc.name}を${linked?'解除':'追加'}`} disabled={disabled} onClick={() => void (linked?detach(doc.id):attach(doc.id))}>{linked ? <><Icon name="close" size={14} />解除</> : <><Icon name="plus" size={14} />追加</>}</button></td></tr>;
      })}</tbody></table>{!rows.length && <p className="quiet-empty">{data.documents.length ? '条件に合う資料はありません' : '登録済みの資料はありません'}</p>}</div>
    </section>}
    {(error || pickError) && <p className="form-error" role="alert">{error || pickError}</p>}
    <div className="modal-footer"><button disabled={disabled} onClick={close}>閉じる</button>{!context && <button className="primary-button" disabled={disabled || !references.trim()} onClick={() => void register(entries)}>{busy ? '登録中…' : '登録する'}</button>}</div>
  </Modal>;
}
