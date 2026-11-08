import type { WorkspaceDatabase } from './db/workspace';
import type { SearchResponse, SearchResult, SearchTarget } from '../shared/search';
import { normalizeSearch } from '../shared/search.ts';
import { record, uuid, invalid } from '../shared/validation.ts';
import {documentType,documentTypeLabels} from '../shared/document-type.ts';
import type {DocumentKind} from '../shared/documents';
type Entry=SearchResult & {fields:string[];normalized:string[]};
export class SearchEngine {
  private entries?:Entry[];
  private database:WorkspaceDatabase;
  constructor(database:WorkspaceDatabase){this.database=database;}
  invalidate(){this.entries=undefined;}
  private corpus() {
    if(this.entries)return this.entries;
    const db=this.database,themes=db.themes(),items=db.items();
    const build=(target:SearchTarget,title:string,detail:string,fields:string[],archived:boolean):Entry=>({...target,title,detail,fields,normalized:fields.map(normalizeSearch),archived,excerpt:''});
    const entries:Entry[]=[...themes.map(t=>build({kind:'theme',id:t.id},t.name,'テーマ',[t.name,t.description],t.archived)),...items.map(i=>build({kind:'item',id:i.id},i.title,`${themes.find(t=>t.id===i.themeId)?.name??'未所属'} · ${i.state}`,[i.title,i.summary,i.body],i.archived||!!themes.find(t=>t.id===i.themeId)?.archived))];
    const uses=db.db.prepare('SELECT documentId,memo FROM document_uses').all();
    for(const row of db.db.prepare('SELECT id,name,reference,description,kind FROM documents').all()){
      const type=documentType({name:String(row.name),reference:String(row.reference),kind:row.kind as DocumentKind});
      entries.push({...build({kind:'document',id:String(row.id)},String(row.name),`資料 · ${documentTypeLabels[type]}`,[String(row.name),String(row.reference),String(row.description),...uses.filter(use=>use.documentId===row.id).map(use=>String(use.memo))],false),documentType:type});
    }
    return this.entries=entries;
  }
  request(raw:unknown):SearchResponse|null {
    const action=raw&&typeof raw==='object'?(raw as {action?:unknown}).action:undefined;
    if(action==='remember'){
      const r=record(raw,['action','target']),target=record(r.target,['kind','id']);const id=uuid(target.id);
      if(!['item','theme','document'].includes(String(target.kind)))invalid();
      const exists=this.database.db.prepare(`SELECT 1 FROM ${target.kind==='item'?'items':target.kind==='theme'?'themes':'documents'} WHERE id=?`).get(id);if(!exists)invalid();
      this.database.db.prepare('INSERT INTO recent_targets VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET openedAt=excluded.openedAt').run(String(target.kind),id,new Date().toISOString());return null;
    }
    const r=record(raw,['action','query','includeArchived']);if(action!=='query'||typeof r.query!=='string'||r.query.length>1000||typeof r.includeArchived!=='boolean')invalid();
    const terms=normalizeSearch(r.query as string).trim().split(/\s+/u).filter(Boolean);
    let matched=this.corpus().filter(entry=>(r.includeArchived||!entry.archived)&&terms.every(term=>entry.normalized.some(field=>field.includes(term))));
    if(!terms.length){const recent=this.database.db.prepare('SELECT kind,id FROM recent_targets ORDER BY openedAt DESC,kind,id').all();matched=recent.flatMap(row=>matched.filter(entry=>entry.kind===row.kind&&entry.id===row.id)).slice(0,20);}
    else matched.sort((a,b)=>Number(b.normalized[0]!.includes(terms[0]!))-Number(a.normalized[0]!.includes(terms[0]!))||a.title.localeCompare(b.title,'ja'));
    return {total:matched.length,results:matched.slice(0,50).map(({fields,normalized,...entry})=>{const index=terms.length?normalized.findIndex(field=>terms.some(term=>field.includes(term))):-1;const field=fields[index>0?index:1]??'';const at=terms.length?Math.max(0,normalizeSearch(field).indexOf(terms[0]!)-20):0;return {...entry,excerpt:(at?'…':'')+field.slice(at,at+120)+(field.length>at+120?'…':'')};})};
  }
}
