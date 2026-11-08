import { isHomeItem, STATES } from './model.ts';
import type { Item, ListView, Theme } from './model.ts';

export type ListScope = { type: 'home' | 'search' | 'archive' } | { type: 'theme'; id: string };
export const viewKey = (scope: ListScope) => scope.type === 'theme' ? `theme:${scope.id}` : scope.type;
export function defaultView(): ListView {
  return { query: '', state: 'all', theme: 'all', sort: 'updatedAt', direction: 'desc', columns: [], showClosed: false,
    includeArchived: false, scrollTop: 0, scrollLeft: 0, mainScrollTop: 0, somedayScrollTop: 0, selectedId: null };
}
export const effectivelyArchived = (item: Item, themes: Theme[]) => item.archived || !!themes.find(theme => theme.id === item.themeId)?.archived;
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja');
export function matchesQuery(item: Item, query: string) {
  const fields = [item.title, item.summary, item.body].map(normalize);
  return normalize(query).trim().split(/\s+/u).filter(Boolean).every(term => fields.some(field => field.includes(term)));
}
const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
export function sortItems(items: Item[], view: ListView): Item[] {
  return [...items].sort((a, b) => {
    const left = a[view.sort], right = b[view.sort];
    // Missing dates stay last regardless of direction. Tie order never flips.
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    const primary = view.sort === 'state' ? STATES.indexOf(a.state) - STATES.indexOf(b.state)
      : left === null || right === null ? 0 : view.sort === 'title' ? collator.compare(left, right) : left.localeCompare(right);
    return primary * (view.direction === 'asc' ? 1 : -1) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
}
export function selectItems(items: Item[], themes: Theme[], scope: ListScope, view: ListView) {
  const parentArchived = scope.type === 'theme' && !!themes.find(theme => theme.id === scope.id)?.archived;
  return sortItems(items.filter(item => {
    const archived = effectivelyArchived(item, themes);
    if (scope.type === 'home' && (!isHomeItem(item) || archived)) return false;
    if (scope.type === 'archive' && !archived) return false;
    if (scope.type === 'search' && archived && !view.includeArchived) return false;
    if (scope.type === 'theme') {
      if (item.themeId !== scope.id || (!parentArchived && item.archived)) return false;
      if (!view.showClosed && ['完了', '中止'].includes(item.state)) return false;
    }
    return (view.state === 'all' || item.state === view.state) &&
      (view.theme === 'all' || (view.theme === 'none' ? item.themeId === null : item.themeId === view.theme)) && matchesQuery(item, view.query);
  }), view);
}
export function somedayItems(items: Item[], themes: Theme[]) {
  return items.filter(item => item.state === 'いつか' && !effectivelyArchived(item, themes)).sort((a, b) =>
    (a.reviewDate === null && b.reviewDate !== null ? 1 : b.reviewDate === null && a.reviewDate !== null ? -1 : a.reviewDate && b.reviewDate ? a.reviewDate.localeCompare(b.reviewDate) : 0) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function dateHints(item: Item, themes: Theme[], today: string) {
  if (effectivelyArchived(item, themes) || ['完了', '中止'].includes(item.state)) return [];
  const hints: string[] = [];
  if (item.dueDate && item.dueDate <= today) hints.push(item.dueDate === today ? '当日期限' : '期限超過');
  if (item.reviewDate && item.reviewDate <= today) hints.push('確認日到来');
  return hints;
}
