import { Documents } from './documents';
import { PagePicker } from './page-picker';
import { BodyEditor } from './body-editor';
import { AddToPlan } from './plans';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './icons';
import { STATES } from '../shared/model';
import type { DraftRef, Item, ItemFields, ItemState } from '../shared/model';
import type { EditorStore } from './editor-store';

export function Modal({ title, children, close, className }: { title: string; children: ReactNode; close: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog=ref.current;if(!dialog)return;
    const input=dialog.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not(:disabled):not([readonly]), textarea:not(:disabled):not([readonly]), [contenteditable=true]');
    // React autoFocus can run while <dialog> is still closed. Set the native
    // target before opening, then focus after showModal before the first paint.
    input?.setAttribute('autofocus','');
    if(!dialog.open)dialog.showModal();
    input?.focus({preventScroll:true});
  }, []);
  return <dialog className={className} ref={ref} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === ref.current) close(); }}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="閉じる" onClick={close}><Icon name="close" /></button></div>{children}</dialog>;
}
export function StatePicker({ value, change, disabled = false }: { value: ItemState; change: (value: ItemState) => void; disabled?: boolean }) {
  return <span className={`state-pill state-${STATES.indexOf(value)}`}><span className="state-dot" /><select aria-label="状態" disabled={disabled} value={value} onChange={event => change(event.target.value as ItemState)}>{STATES.map(state => <option key={state}>{state}</option>)}</select></span>;
}
export function ItemDetail({ item, items, store, open, openTheme, notify, archive }: { item: Item; items: Item[]; store: EditorStore; open: (id: string) => void; openTheme?: (id: string) => void; notify: (message: string) => void; archive: (kind: 'item' | 'theme', id: string, archived: boolean) => void }) {
  const ref = { kind: 'item' as const, id: item.id };
  const state = store.getSnapshot();
  const parent = state.data.themes.find(theme => theme.id === item.themeId);
  const readOnly = item.archived || !!parent?.archived;
  const [datesOpen, setDatesOpen] = useState(!!item.dueDate || !!item.reviewDate);
  const [linking, setLinking] = useState<DraftRef>();
  const [planning,setPlanning]=useState(false);
  const related = state.data.links.filter(link => link.sourceId === item.id || link.targetId === item.id);
  const relatedIds = related.map(link => link.sourceId === item.id ? link.targetId : link.sourceId);
  const edit = (patch: Partial<ItemFields>, composing = false) => store.edit(ref, patch, composing);
  return <article className="item-page page-content"><header className="item-header"><div className="detail-actions">{!readOnly&&<button className="text-button" onClick={()=>setPlanning(true)}><Icon name="plan" size={14}/>計画に追加</button>}<button className="text-button" onClick={() => archive(item.archived || !parent?.archived ? 'item' : 'theme', item.archived || !parent?.archived ? item.id : parent.id, !readOnly)}><Icon name={readOnly ? 'backup' : 'archive'} size={16} />{readOnly ? item.archived ? 'ページを復元' : 'テーマを復元' : 'アーカイブ'}</button></div><div className="page-emblem"><Icon name="file" size={30} /></div><textarea className="heading-input item-title" aria-label="タイトル" readOnly={readOnly} value={item.title} rows={1} placeholder="無題のページ" onChange={event => edit({ title: event.target.value }, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event => edit({ title: event.currentTarget.value })} /></header>
    {readOnly && <div className="archived-notice"><Icon name="archive" size={16} />{item.archived ? 'アーカイブしたページです' : '所属テーマがアーカイブされています'}{item.archived && parent?.archived && <button className="text-button" onClick={() => archive('theme', parent.id, false)}>テーマを復元</button>}</div>}
    <div className="properties"><div className="property-row"><span className="property-label"><span className="tiny-dot" />状態</span><StatePicker disabled={readOnly} value={item.state} change={value => edit({ state: value })} /></div>
      <div className="property-row"><label className="property-label" htmlFor="item-theme"><Icon name="folder" size={15} />テーマ</label><select id="item-theme" disabled={readOnly} className="property-select" value={item.themeId ?? ''} onChange={event => edit({ themeId: event.target.value || null })}><option value="">未所属</option>{state.data.themes.filter(theme => !theme.archived || theme.id === item.themeId).map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></div>
      <div className="property-row summary-row"><label className="property-label" htmlFor="item-summary"><Icon name="file" size={15} />サマリ</label><div className="property-value"><textarea id="item-summary" readOnly={readOnly} placeholder="状況や、取り組む条件を短く…" rows={2} value={item.summary} onChange={event => edit({ summary: event.target.value }, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event => edit({ summary: event.currentTarget.value })} />{[...item.summary].length > 450 && <small className={[...item.summary].length > 500 ? 'error-text' : ''}>{[...item.summary].length} / 500</small>}</div></div>
      {datesOpen ? <div className="date-properties">{(['dueDate', 'reviewDate'] as const).map((field, index) => <div className="property-row" key={field}><label className="property-label" htmlFor={field}><Icon name={index ? 'clock' : 'calendar'} size={15} />{index ? '確認日' : '期限'}</label><input id={field} type="date" disabled={readOnly} value={item[field] ?? ''} onChange={event => edit({ [field]: event.target.value || null })} />{item[field] && <button className="icon-button" disabled={readOnly} aria-label={index ? '確認日を解除' : '期限を解除'} onClick={() => edit({ [field]: null })}><Icon name="close" size={14} /></button>}</div>)}</div> : <button className="add-property" disabled={readOnly} onClick={() => setDatesOpen(true)}><Icon name="plus" size={14} />期限・確認日を設定</button>}
    </div>
    <BodyEditor item={item} store={store} readOnly={readOnly} notify={notify} split={title=>{const draft=store.create('new-item',item.themeId,item.id);store.edit(draft,{title});setLinking(draft);}} />
    {planning&&<AddToPlan item={item} themes={state.data.themes} close={()=>setPlanning(false)}/>}
    <Documents context={{ kind: 'item', id: item.id }} items={items} themes={state.data.themes} openItem={open} openTheme={openTheme} readOnly={readOnly} />
    <section className="related-section"><div className="section-toolbar"><h2><Icon name="link" size={16} />関連ページ</h2><button className="text-button" disabled={readOnly} onClick={() => setLinking(store.create('new-item', item.themeId, item.id))}><Icon name="plus" size={14} />ページを追加</button></div>
      {related.map(link => { const other = items.find(other => other.id === (link.sourceId === item.id ? link.targetId : link.sourceId)); return other && <div className="related-row" key={other.id}><button className="page-link" onClick={() => open(other.id)}><Icon name="file" size={16} /><span>{other.title}</span></button><button className="icon-button" disabled={readOnly} title="関連を解除（ページは保持）" aria-label={`${other.title}との関連を解除`} onClick={async () => { const result = await store.unlink(item.id, other.id); if (!result.ok) notify(result.error.message); }}><Icon name="close" size={14} /></button></div>; })}
      {!related.length && <p className="quiet-empty">関連するページはまだありません</p>}
      {linking && <PagePicker item={item} items={items} themes={state.data.themes} relatedIds={relatedIds} draft={linking} store={store} close={() => setLinking(undefined)} notify={notify} />}
    </section></article>;
}
