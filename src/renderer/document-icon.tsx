import {documentType,documentTypeLabels} from '../shared/document-type';
import type {DocumentType} from '../shared/document-type';
import type {WorkspaceDocument} from '../shared/documents';
import {Icon} from './icons';
const glyphs:Partial<Record<DocumentType,string>>={pdf:'PDF',powerpoint:'P',word:'W',excel:'X',text:'≡',archive:'Z'};
const paths:Partial<Record<DocumentType,string>>={image:'M4 4h16v16H4Z M4 16l5-5 4 4 3-3 4 4 M15 8h.01',video:'M3 5h13v14H3Z M16 9l5-3v12l-5-3',audio:'M9 18V5l11-2v13 M9 5v4l11-2 M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3 M20 16a3 3 0 1 1-3-3c2 0 3 1 3 3'};
export function DocumentIcon({doc,type,size=17}:{doc?:Pick<WorkspaceDocument,'kind'|'reference'|'name'>;type?:DocumentType;size?:number}){
  const value=type??(doc?documentType(doc):'file'),glyph=glyphs[value],path=paths[value];
  return <span className={`document-type-icon document-type-${value}`} data-document-type={value} role="img" aria-label={documentTypeLabels[value]} title={documentTypeLabels[value]}>
    {glyph||path?<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{path?<path d={path}/>:<><path d="M14 2H5v20h14V7Z M14 2v6h5"/><text x="12" y="17.5" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="Segoe UI,sans-serif" fontWeight="700" fontSize={value==='pdf'?6.5:11}>{glyph}</text></>}</svg>:<Icon name={value==='folder'?'folder':value==='url'?'globe':'file'} size={size}/>}</span>;
}
