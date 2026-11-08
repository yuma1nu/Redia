import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { defaultView, selectItems } from '../shared/lists';
import { isSubmitKey, STATES } from '../shared/model';
import type { DraftRef, Item, ListView, NewItemFields, Theme } from '../shared/model';
import type { EditorStore } from './editor-store';
import { Modal } from './components';
import { Icon } from './icons';

export function PagePicker({ item, items, themes, relatedIds, draft, store, close, notify }: {
  item: Item; items: Item[]; themes: Theme[]; relatedIds: string[]; draft: DraftRef;
  store: EditorStore; close: () => void; notify: (message: string) => void;
}) {
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [view, setView] = useState<ListView>(() => ({ ...defaultView(), sort: 'title', direction: 'asc' }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const list = useRef<HTMLDivElement>(null), working = useRef(false);
  const titleInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{titleInput.current?.focus();},[]);
  const buffer = store.buffer(draft), fields = buffer.fields as NewItemFields;
  const rows = selectItems(items.filter(other => other.id !== item.id), themes, { type: 'search' }, view);
  const filter = (patch: Partial<ListView>) => { setView(current => ({ ...current, ...patch })); if (list.current) list.current.scrollTop = 0; };
  const finish = () => { if (!working.current) close(); };
  async function create() {
    if (working.current || buffer.hold || !fields.title.trim()) return;
    working.current = true; setBusy(true); setError('');
    try {
      if (!await store.save({ kind: 'item', id: item.id })) { setError('元ページを保存できませんでした。入力を確認して再試行してください。'); return; }
      if (await store.save(draft)) { close(); notify('ページを作成して関連付けました'); }
    } finally { working.current = false; setBusy(false); }
  }
  async function attach(id: string) {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      const result = await store.link(item.id, id);
      if (result.ok) { close(); notify('ページを関連付けました'); }
      else setError(result.error.message);
    } finally { working.current = false; setBusy(false); }
  }
  return <Modal title="関連ページを追加" className="page-picker-dialog" close={finish}>
    <form className="page-register-area" onSubmit={event => { event.preventDefault(); void create(); }}>
      <label className="form-label" htmlFor="related-page-title">新しいページを作成</label>
      <div className="page-title-entry"><input ref={titleInput} id="related-page-title" autoFocus autoComplete="off" disabled={busy} placeholder="タイトルを入力…" value={fields.title}
        onChange={event => store.edit(draft, { title: event.target.value }, (event.nativeEvent as InputEvent).isComposing)}
        onCompositionEnd={event => store.edit(draft, { title: event.currentTarget.value })}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (isSubmitKey(event.nativeEvent)) void create(); } }} />
        <button className="outline-button" type="submit" disabled={busy || !fields.title.trim()}><Icon name="plus" size={15} />作成して追加</button></div>
      {buffer.error && <p className="form-error" role="alert">{buffer.error}</p>}
    </form>
    <section className="page-choose-area" aria-label="登録済みのページから選択"><h3>登録済みのページ<span className="count">{rows.length}</span></h3>
      <div className="page-picker-filters"><div className="list-search"><Icon name="search" size={15} /><input aria-label="追加するページを検索" placeholder="タイトル・サマリ・本文を検索" value={view.query} onChange={event => filter({ query: event.target.value })} /></div>
        <select aria-label="追加するページの状態" value={view.state} onChange={event => filter({ state: event.target.value as ListView['state'] })}><option value="all">すべての状態</option>{STATES.map(state => <option key={state}>{state}</option>)}</select>
        <select aria-label="追加するページのテーマ" value={view.theme} onChange={event => filter({ theme: event.target.value })}><option value="all">すべてのテーマ</option><option value="none">未所属</option>{themes.filter(theme => !theme.archived).map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select>
        {(view.query || view.state !== 'all' || view.theme !== 'all') && <button className="text-button" onClick={() => filter({ query: '', state: 'all', theme: 'all' })}>条件を解除</button>}
      </div>
      <div className="page-picker-list" ref={list}><table><thead><tr><th>タイトル</th><th>状態</th><th>テーマ</th><th aria-label="操作" /></tr></thead><tbody>{rows.map(other => {
        const attached = relatedIds.includes(other.id);
        return <tr key={other.id} data-picker-page={other.id}><td title={other.title}><div className="page-picker-title"><Icon name="file" size={15} /><span>{other.title}</span></div></td><td><span className={`state-pill state-${STATES.indexOf(other.state)}`}>{other.state}</span></td><td className="page-picker-theme" title={themes.find(theme => theme.id === other.themeId)?.name}>{themes.find(theme => theme.id === other.themeId)?.name ?? '未所属'}</td><td><button className="text-button" aria-label={`${other.title}を追加`} disabled={busy || attached} onClick={() => void attach(other.id)}><Icon name={attached ? 'check' : 'plus'} size={14} />{attached ? '追加済み' : '追加'}</button></td></tr>;
      })}</tbody></table>{!rows.length && <p className="quiet-empty">{items.length <= 1 ? '追加できるページはまだありません' : '条件に一致するページはありません'}</p>}</div>
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-footer"><button className="muted-button" disabled={busy} onClick={finish}>閉じる</button></div>
  </Modal>;
}
