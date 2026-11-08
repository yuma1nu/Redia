import type { ReactNode } from 'react';
import { Icon } from './icons';
import { ItemTable, ListControls, SomedayPanel } from './lists-ui';
import { selectItems, somedayItems, sortItems, viewKey } from '../shared/lists';
import type { ListScope } from '../shared/lists';
import type { Item, ListView, ThemeFields } from '../shared/model';
import type { EditorStore } from './editor-store';
import type { ViewStore } from './view-store';

export function Overview({ scope, store, views, items, today, open, openTheme, create, notify, archive, children }: {
  scope: ListScope; store: EditorStore; views: ViewStore; items: Item[]; today: string; open: (id: string) => void;
  openTheme: (id: string) => void; create: (themeId: string | null) => void; notify: (message: string) => void;
  archive: (kind: 'item' | 'theme', id: string, archived: boolean) => void; children: ReactNode;
}) {
  const data = store.getSnapshot().data, key = viewKey(scope), view = views.get(key);
  const theme = scope.type === 'theme' ? data.themes.find(theme => theme.id === scope.id) : undefined;
  const composingIds = new Set(Object.values(store.getSnapshot().buffers).filter(buffer => buffer.ref.kind === 'item' && buffer.hold).map(buffer => buffer.ref.id));
  const matched = selectItems(items, data.themes, scope, view);
  // Keep the editing element mounted until IME commits; then re-evaluate the query.
  const composing = composingIds.size ? selectItems(items.filter(item => composingIds.has(item.id)), data.themes, scope, { ...view, query: '' }) : [];
  const rows = composing.length ? sortItems([...new Map([...matched, ...composing].map(item => [item.id, item])).values()], view) : matched;
  const change = (patch: Partial<ListView>) => views.patch(key, patch);
  const filter = (patch: Partial<ListView>) => change({ ...patch, scrollTop: 0, selectedId: null });
  const archivedThemes = data.themes.filter(theme => theme.archived && (view.theme === 'all' || view.theme === theme.id) &&
    (!view.query.trim() || `${theme.name} ${theme.description}`.normalize('NFKC').toLowerCase().includes(view.query.normalize('NFKC').toLowerCase().trim())));
  return <div className={`overview page-content ${scope.type === 'home' ? 'home-overview' : 'other-overview'}`}>
    <header className="page-header">
      {theme && <button className="text-button page-actions" onClick={() => archive('theme', theme.id, !theme.archived)}><Icon name={theme.archived ? 'backup' : 'archive'} size={16} />{theme.archived ? 'テーマを復元' : 'テーマをアーカイブ'}</button>}
      <div className="page-emblem"><Icon name={theme ? 'folder' : scope.type === 'search' ? 'search' : scope.type === 'archive' ? 'archive' : 'home'} size={28} /></div>
      {theme ? <><input aria-label="テーマ名" className="heading-input" readOnly={theme.archived} value={(store.buffer({ kind: 'theme', id: theme.id }).fields as ThemeFields).name}
        onChange={event => store.edit({ kind: 'theme', id: theme.id }, { name: event.target.value }, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event => { if (!theme.archived) store.edit({ kind: 'theme', id: theme.id }, { name: event.currentTarget.value }); }} />
        <textarea className="theme-description" readOnly={theme.archived} aria-label="テーマの説明" placeholder="このテーマの説明を追加…" rows={1} value={(store.buffer({ kind: 'theme', id: theme.id }).fields as ThemeFields).description}
          onChange={event => store.edit({ kind: 'theme', id: theme.id }, { description: event.target.value }, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event => { if (!theme.archived) store.edit({ kind: 'theme', id: theme.id }, { description: event.currentTarget.value }); }} /></> : <h1>{scope.type === 'search' ? '検索' : scope.type === 'archive' ? 'アーカイブ' : 'HOME'}</h1>}
      {theme?.archived && <div className="archived-notice"><Icon name="archive" size={15} />アーカイブしたテーマです</div>}
    </header>
    <section className="current-section">
      <div className="section-toolbar"><h2><Icon name="inbox" size={17} />{scope.type === 'home' ? '取り組むページ' : 'ページ'}<span className="count">{rows.length}</span></h2>
        {scope.type !== 'archive' && <button className="primary-button" disabled={theme?.archived} onClick={() => create(theme?.id ?? null)}><Icon name="plus" size={16} />新規ページ</button>}
      </div>
      <ListControls view={view} scope={scope} themes={data.themes} change={filter} />
      {scope.type === 'archive' && !!archivedThemes.length && <div className="archived-themes"><h3>テーマ</h3>{archivedThemes.map(theme => <div className="archived-theme-row" key={theme.id}><button className="page-link" onClick={() => openTheme(theme.id)}><Icon name="folder" size={16} /><span>{theme.name}</span></button><button className="text-button" onClick={() => archive('theme', theme.id, false)}><Icon name="backup" size={14} />復元</button></div>)}</div>}
      <ItemTable key={key} tableKey={key} rows={rows} themes={data.themes} store={store} open={open} openTheme={openTheme} notify={notify} view={view} change={change} today={today} archive={archive} showTheme={scope.type !== 'theme'} />
    </section>
    {scope.type === 'home' && <SomedayPanel items={somedayItems(items, data.themes)} allItems={items} themes={data.themes} links={data.links} store={store} today={today} open={open} view={view} change={change} notify={notify} />}
    {children}
  </div>;
}
