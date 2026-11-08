import { useLayoutEffect, useRef } from 'react';
import { Icon } from './icons';
import { StatePicker } from './components';
import { OPTIONAL_COLUMNS, STATES } from '../shared/model';
import { dateHints, defaultView, effectivelyArchived, matchesQuery } from '../shared/lists';
import type { Item, ItemLink, ListView, Theme } from '../shared/model';
import type { ListScope } from '../shared/lists';
import type { EditorStore } from './editor-store';

const columnNames = { dueDate: '期限', reviewDate: '確認日', updatedAt: '更新日時' };
const sortNames = { title: 'タイトル', state: '状態', updatedAt: '更新日時', dueDate: '期限', reviewDate: '確認日' };
export function ListControls({ view, scope, themes, change }: { view: ListView; scope: ListScope; themes: Theme[]; change: (patch: Partial<ListView>) => void }) {
  const filtered = !!view.query || view.state !== 'all' || view.theme !== 'all';
  return <><div className="list-controls">
    <div className="list-search"><Icon name="search" size={15} /><input aria-label="一覧を検索" placeholder="ページのタイトル・サマリ・本文を検索" value={view.query} onChange={event => change({ query: event.target.value })} />{view.query && <button className="icon-button" aria-label="検索条件を解除" onClick={() => change({ query: '' })}><Icon name="close" size={13} /></button>}</div>
    <select aria-label="状態で絞り込み" value={view.state} onChange={event => change({ state: event.target.value as ListView['state'] })}><option value="all">すべての状態</option>{STATES.filter(state => scope.type !== 'home' || ['未着手', '進行中', '待ち'].includes(state)).map(state => <option key={state}>{state}</option>)}</select>
    {scope.type !== 'theme' && <select aria-label="テーマで絞り込み" value={view.theme} onChange={event => change({ theme: event.target.value })}><option value="all">すべてのテーマ</option><option value="none">未所属</option>{themes.map(theme => <option value={theme.id} key={theme.id}>{theme.name}{theme.archived ? '（アーカイブ）' : ''}</option>)}</select>}
    <select aria-label="並び順" value={view.sort} onChange={event => change({ sort: event.target.value as ListView['sort'] })}>{Object.entries(sortNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>
    <button className="sort-direction" aria-label="並べ替え方向" onClick={() => change({ direction: view.direction === 'asc' ? 'desc' : 'asc' })}>{view.direction === 'asc' ? '昇順' : '降順'}</button>
    <details className="columns-menu"><summary><Icon name="columns" size={15} />表示列</summary><div role="group" aria-label="表示列">{OPTIONAL_COLUMNS.map(column => <label key={column}><input type="checkbox" checked={view.columns.includes(column)} onChange={event => change({ columns: OPTIONAL_COLUMNS.filter(key => key === column ? event.target.checked : view.columns.includes(key)) })} />{columnNames[column]}</label>)}</div></details>
    {scope.type === 'theme' && <label className="toggle"><input type="checkbox" checked={view.showClosed} onChange={event => change({ showClosed: event.target.checked })} />完了・中止を含む</label>}
  </div><div className="filter-line">
    {scope.type === 'search' && <label className="toggle"><input type="checkbox" checked={view.includeArchived} onChange={event => change({ includeArchived: event.target.checked })} />アーカイブを含む</label>}
    {view.state !== 'all' && <button className="filter-chip" aria-label="状態条件を解除" onClick={() => change({ state: 'all' })}>{view.state}<Icon name="close" size={12} /></button>}
    {view.theme !== 'all' && <button className="filter-chip" aria-label="テーマ条件を解除" onClick={() => change({ theme: 'all' })}>{view.theme === 'none' ? '未所属' : themes.find(theme => theme.id === view.theme)?.name ?? 'テーマ'}<Icon name="close" size={12} /></button>}
    {filtered && <button className="text-button" onClick={() => change({ query: '', state: 'all', theme: 'all' })}>絞り込みを解除</button>}
  </div></>;
}
export function DateHints({ item, themes, today }: { item: Item; themes: Theme[]; today: string }) {
  const hints = dateHints(item, themes, today);
  return !!hints.length && <span className="date-hints" aria-label={hints.join('・')}>{hints.map(hint => <span key={hint} className={hint === '期限超過' ? 'overdue' : 'review-due'} title={hint === '確認日到来' ? item.reviewDate! : item.dueDate!}>{hint}</span>)}</span>;
}
export function ItemTable({ rows, themes, store, open, openTheme, notify, view = defaultView(), change, today, archive, tableKey, showTheme = true }: {
  rows: Item[]; themes: Theme[]; store: EditorStore; open: (id: string) => void; openTheme: (id: string) => void; notify: (message: string) => void;
  view?: ListView; change: (patch: Partial<ListView>) => void; today: string; archive: (kind: 'item' | 'theme', id: string, archived: boolean) => void; tableKey: string; showTheme?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) { element.scrollTop = view.scrollTop; element.scrollLeft = view.scrollLeft; }
  }, [view.scrollTop, view.scrollLeft, tableKey]);
  useLayoutEffect(() => {
    if (view.selectedId) ref.current?.querySelector<HTMLButtonElement>(`[data-item-id="${view.selectedId}"] .page-link`)?.focus({ preventScroll: true });
  }, [tableKey]);
  function heading(field: ListView['sort']) {
    return <button className="sort-heading" onClick={() => change({ sort: field, direction: view.sort === field && view.direction === 'asc' ? 'desc' : 'asc', scrollTop: 0 })}>{sortNames[field]}{view.sort === field && <span aria-hidden="true">{view.direction === 'asc' ? '↑' : '↓'}</span>}</button>;
  }
  function editSummary(item: Item, summary: string, composing = false) {
    store.edit({ kind: 'item', id: item.id }, { summary }, composing);
    if (!composing && !matchesQuery({ ...item, summary }, view.query)) notify('サマリを変更し、一覧の表示条件から外れました');
  }
  return <div className="table-wrap item-table-scroll" ref={ref} onScroll={event => change({ scrollTop: event.currentTarget.scrollTop, scrollLeft: event.currentTarget.scrollLeft })}>
    <table className={view.columns.length ? 'extended-table' : ''} style={view.columns.length ? { minWidth: (showTheme ? 850 : 690) + view.columns.length * 145 } : undefined}><thead><tr>
      <th aria-sort={view.sort === 'title' ? view.direction === 'asc' ? 'ascending' : 'descending' : undefined}>{heading('title')}</th>
      <th className="state-column" aria-sort={view.sort === 'state' ? view.direction === 'asc' ? 'ascending' : 'descending' : undefined}>{heading('state')}</th>{showTheme && <th className="theme-column"><Icon name="folder" size={14} />テーマ</th>}<th className="summary-column">サマリ</th>
      {view.columns.map(column => <th className="optional-column" key={column} aria-sort={view.sort === column ? view.direction === 'asc' ? 'ascending' : 'descending' : undefined}>{heading(column)}</th>)}<th className="row-action-column"><span className="sr-only">操作</span></th>
    </tr></thead><tbody>{rows.map(item => {
      const archived = effectivelyArchived(item, themes), theme = themes.find(theme => theme.id === item.themeId);
      const restoreTheme = !item.archived && !!theme?.archived;
      return <tr key={item.id} data-item-id={item.id} data-return-anchor={view.selectedId === item.id}>
        <td><button className="page-link" title={item.title} onClick={() => { change({ selectedId: item.id }); open(item.id); }}><Icon name="file" size={16} /><span>{item.title}</span></button><DateHints item={item} themes={themes} today={today} />{archived && <small className="archive-mark">{item.archived ? 'アーカイブ' : 'テーマのアーカイブにより非表示'}</small>}</td>
        <td><StatePicker value={item.state} disabled={archived} change={value => { store.edit({ kind: 'item', id: item.id }, { state: value }); notify(`状態を「${value}」に変更しました`); }} /></td>
        {showTheme && <td><button className="theme-cell" disabled={!item.themeId} onClick={() => item.themeId && openTheme(item.themeId)}>{theme?.name ?? '未所属'}</button></td>}
        <td><input className="cell-input" readOnly={archived} aria-label={`${item.title}のサマリ`} placeholder="サマリを追加…" value={item.summary} title={item.summary} onChange={event => editSummary(item, event.target.value, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event => { if (!archived) editSummary(item, event.currentTarget.value); }} /></td>
        {view.columns.map(column => <td className="optional-column" key={column}>{column === 'updatedAt' ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.updatedAt)) : item[column] ?? '—'}</td>)}
        <td className="row-action-column"><button className="icon-button" aria-label={restoreTheme ? `${theme!.name}のテーマを復元` : `${item.title}を${archived ? '復元' : 'アーカイブ'}`} title={restoreTheme ? '所属テーマを復元' : archived ? '復元' : 'アーカイブ'} onClick={() => archive(item.archived || !theme?.archived ? 'item' : 'theme', item.archived || !theme?.archived ? item.id : theme.id, !archived)}><Icon name={archived ? 'backup' : 'archive'} size={15} /></button></td>
      </tr>;
    })}</tbody></table>{!rows.length && <div className="empty-list"><Icon name="inbox" size={28} /><span>表示するページはありません</span></div>}
  </div>;
}
export function SomedayPanel({ items, allItems, themes, links, store, today, open, view, change, notify }: {
  items: Item[]; allItems: Item[]; themes: Theme[]; links: ItemLink[]; store: EditorStore; today: string; open: (id: string) => void; view: ListView; change: (patch: Partial<ListView>) => void; notify: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = view.somedayScrollTop; }, [view.somedayScrollTop]);
  useLayoutEffect(() => { if (view.selectedId) ref.current?.querySelector<HTMLButtonElement>(`[data-item-id="${view.selectedId}"] .page-link`)?.focus({ preventScroll: true }); }, []);
  const due = items.filter(item => dateHints(item, themes, today).length).length;
  return <section className="someday"><div className="section-toolbar"><h2><Icon name="bulb" size={18} />いつか<span className="count">{items.length}</span>{due > 0 && <button className="review-count" aria-label="日付の確認が必要なページへ移動" onClick={() => { const first = ref.current?.querySelector<HTMLElement>('[data-date-due=true]'); if (first && ref.current) ref.current.scrollTop = first.offsetTop; }}>日付の確認 {due}</button>}</h2></div>
    <div className="someday-list" ref={ref} onScroll={event => change({ somedayScrollTop: event.currentTarget.scrollTop })}>
      {!items.length ? <div className="someday-empty"><p>いつかのページはありません</p></div> : items.map(item => {
        const originLink = links.find(link => link.targetId === item.id && link.kind === 'derived');
        const origin = allItems.find(other => other.id === originLink?.sourceId);
        return <div className="someday-row" data-return-anchor={view.selectedId === item.id} key={item.id} data-item-id={item.id} data-date-due={dateHints(item, themes, today).length > 0}>
          <div><button className="page-link" title={item.title} onClick={() => { change({ selectedId: item.id }); open(item.id); }}><Icon name="file" size={16} /><span>{item.title}</span></button><DateHints item={item} themes={themes} today={today} /></div>
          <StatePicker value={item.state} change={value => { store.edit({ kind: 'item', id: item.id }, { state: value }); notify(`状態を「${value}」に変更しました`); }} />
          <input className="cell-input" aria-label={`${item.title}のサマリ`} placeholder="サマリを追加…" title={item.summary} value={item.summary} onChange={event => store.edit({ kind: 'item', id: item.id }, { summary: event.target.value }, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event => store.edit({ kind: 'item', id: item.id }, { summary: event.currentTarget.value })} />
          {origin ? <button className="origin-link" title={origin.title} onClick={() => open(origin.id)}><Icon name="link" size={13} />{origin.title}</button> : <span />}
          <span className="date-label">{item.reviewDate && <><Icon name="calendar" size={13} />{item.reviewDate}</>}</span>
        </div>;
      })}
    </div></section>;
}
