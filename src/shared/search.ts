export type SearchTarget = { kind:'theme'|'item'|'document'; id:string };
export type SearchResult = SearchTarget & {title:string;detail:string;excerpt:string;archived:boolean;documentType?:import('./document-type').DocumentType};
export type SearchRequest = {action:'query';query:string;includeArchived:boolean}|{action:'remember';target:SearchTarget};
export type SearchResponse = {results:SearchResult[];total:number};
export const normalizeSearch = (text:string)=>text.normalize('NFKC').toLocaleLowerCase('ja');
