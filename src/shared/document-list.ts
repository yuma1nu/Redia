import type { DocumentSnapshot, DocumentView } from './documents.ts';
import type { Item } from './model.ts';
import {matchesDocumentType} from './document-type.ts';

export function selectDocuments(data: DocumentSnapshot, items: Pick<Item, 'id' | 'themeId'>[], view: Pick<DocumentView, 'query' | 'kind' | 'theme' | 'sort'>) {
  const words = view.query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return data.documents.filter(doc => {
    const uses = data.uses.filter(use => use.documentId === doc.id);
    const text = `${doc.name} ${doc.reference} ${doc.description} ${uses.map(use => use.memo).join(' ')}`.normalize('NFKC').toLowerCase();
    const matchesTheme = view.theme === 'all' || (view.theme === 'none' ? !uses.length : uses.some(use => use.kind === 'theme' ? use.contextId === view.theme : items.some(item => item.id === use.contextId && item.themeId === view.theme)));
    return words.every(word => text.includes(word)) && matchesDocumentType(doc,view.kind) && matchesTheme;
  }).sort((a, b) => (view.sort.startsWith('name') ? a.name.localeCompare(b.name, 'ja', { numeric: true }) : a.updatedAt.localeCompare(b.updatedAt)) * (view.sort.endsWith('desc') ? -1 : 1) || a.id.localeCompare(b.id));
}
