import { invalid, record, uuid } from './validation.ts';
export type PlanRow = { id:string; title:string; themeId:string|null; itemIds:string[]; start:string|null; end:string|null; baselineStart:string|null; baselineEnd:string|null; actualStart:string|null; actualEnd:string|null };
export type PlanSnapshot = {revision:number;rows:PlanRow[]};
export type PlanView={theme:string;query:string;selectedId:string|null;compare:boolean;scale:'week'|'month'|'quarter';from:string;scrollLeft:number;scrollTop:number;listCollapsed?:boolean};
export type PlanDraft = {baseRevision:number;token:string;rows:PlanRow[]};
export type PlanResponse = PlanSnapshot & {draft?:PlanDraft;view?:PlanView};
export type PlanRequest = {action:'load'}|{action:'stage';draft:PlanDraft}|{action:'commit'|'discard';token:string}|{action:'view';view:PlanView};
export const planDateKeys=['start','end','baselineStart','baselineEnd','actualStart','actualEnd'] as const;
export const emptyPlan=(title:string,themeId:string|null=null,itemIds:string[]=[]):PlanRow=>({id:crypto.randomUUID(),title,themeId,itemIds,start:null,end:null,baselineStart:null,baselineEnd:null,actualStart:null,actualEnd:null});
export function dateNumber(date:string){return Date.parse(date+'T00:00:00Z')/86400000;}
export function validPlanDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='0001-01-01'&&Number.isFinite(dateNumber(value))&&new Date(dateNumber(value)*86400000).toISOString().slice(0,10)===value;}
export function shiftDate(value:string,days:number){const date=new Date((dateNumber(value)+days)*86400000).toISOString().slice(0,10);if(!validPlanDate(date))invalid('日付は0001年〜9999年の範囲で指定してください。');return date;}
export function validatePlanDraft(raw:unknown,commit=false,today?:string):PlanDraft {
  const input=record(raw,['baseRevision','token','rows']);
  if(!Number.isSafeInteger(input.baseRevision)||Number(input.baseRevision)<0||!Array.isArray(input.rows))invalid();
  if(JSON.stringify(raw).length>16*1024*1024)invalid('計画の入力が大きすぎます。入力を保持しています。行名や関連を調整してください。');
  const ids=new Set<string>();
  const rows=input.rows.map(value=>{
    const r=record(value,['id','title','themeId','itemIds',...planDateKeys]);
    const id=uuid(r.id);if(ids.has(id))invalid('計画行が重複しています。');ids.add(id);
    if(typeof r.title!=='string'||r.title.includes('\0')||!Array.isArray(r.itemIds))invalid();
    const row:PlanRow={id,title:r.title,themeId:r.themeId===null?null:uuid(r.themeId),itemIds:r.itemIds.map(uuid),start:null,end:null,baselineStart:null,baselineEnd:null,actualStart:null,actualEnd:null};
    if(new Set(row.itemIds).size!==row.itemIds.length)invalid();
    for(const key of planDateKeys){const date=r[key];if(date!==null&&(typeof date!=='string'||date.length>10))invalid();row[key]=date as string|null;if(commit&&date!==null&&!validPlanDate(date as string))invalid('存在する日付を入力してください。');}
    if(commit){
      if(!row.title.trim())invalid('計画行のタイトルを入力してください。入力は保持しています。');
      for(const [a,b] of [['start','end'],['baselineStart','baselineEnd'],['actualStart','actualEnd']] as const)if(row[a]&&row[b]&&row[b]!<row[a]!)invalid('終了日は開始日以降にしてください。入力は保持しています。');
      if(row.actualEnd&&!row.actualStart)invalid('実績の終了日には開始日が必要です。');
      if(today&&[row.actualStart,row.actualEnd].some(date=>date&&date>today))invalid('実績に未来日は設定できません。入力は保持しています。');
    }
    return row;
  });
  return {baseRevision:Number(input.baseRevision),token:uuid(input.token),rows};
}
export function saveBaseline(rows:PlanRow[],themeId:string|null){return rows.map(row=>row.themeId===themeId?{...row,baselineStart:row.start,baselineEnd:row.end}:row);}
export function movePlan(rows:PlanRow[],id:string,targetId:string){const next=[...rows],index=next.findIndex(row=>row.id===id),to=next.findIndex(row=>row.id===targetId);if(index<0||to<0)return rows;const [row]=next.splice(index,1);next.splice(to,0,row);return next;}
export function dragDates(row:PlanRow,days:number,mode:'move'|'start'|'end'):PlanRow {
  if(mode==='move')return {...row,start:row.start?shiftDate(row.start,days):null,end:row.end?shiftDate(row.end,days):null};
  const date=row[mode];if(!date)return row;
  const shifted=shiftDate(date,days);return {...row,[mode]:mode==='start'&&row.end&&shifted>row.end?row.end:mode==='end'&&row.start&&shifted<row.start?row.start:shifted};
}
export function timelineTicks(from:string,days:number,scale:'day'|'week'|'month'){
  const ticks:{offset:number;label:string}[]=[];
  for(let offset=0;offset<days;offset++){const date=shiftDate(from,offset);if(scale==='day'||scale==='week'&&offset%7===0||scale==='month'&&date.endsWith('-01'))ticks.push({offset,label:scale==='month'?date.slice(0,7):date.slice(5).replace('-','/')});}
  return ticks;
}
export function validatePlanView(raw:unknown):PlanView {
  const hasCollapsed=!!raw&&typeof raw==='object'&&Object.hasOwn(raw,'listCollapsed');
  const view=record(raw,['theme','query','selectedId','compare','scale','from','scrollLeft','scrollTop',...(hasCollapsed?['listCollapsed']:[])]);
  if(hasCollapsed&&typeof view.listCollapsed!=='boolean')invalid();
  if(view.theme!=='all'&&view.theme!=='none')uuid(view.theme);
  if(typeof view.query!=='string'||view.query.includes('\0')||typeof view.compare!=='boolean'||!['day','week','month','quarter'].includes(String(view.scale))||typeof view.from!=='string'||!validPlanDate(view.from))invalid();
  for(const key of ['scrollLeft','scrollTop'])if(typeof view[key]!=='number'||!Number.isFinite(view[key])||Number(view[key])<0)invalid();
  if(view.selectedId!==null)uuid(view.selectedId);
  return {...view,scale:view.scale==='day'?'week':view.scale,listCollapsed:view.listCollapsed??false} as PlanView;
}
