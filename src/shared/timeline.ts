import { dateNumber,dragDates,shiftDate } from './plans.ts';
import type { PlanRow,PlanView } from './plans.ts';

export function groupPlanRows(rows:PlanRow[],themes:{id:string;name:string}[]){
  return [...themes.map(theme=>({id:theme.id as string|null,name:theme.name,rows:rows.filter(row=>row.themeId===theme.id)})),{id:null,name:'未所属',rows:rows.filter(row=>row.themeId===null)}].filter(group=>group.rows.length);
}

export function timelineWindowDays(from:string,scale:PlanView['scale']){
  const available=dateNumber('9999-12-31')-dateNumber(from)+1;if(scale==='week')return Math.min(14,available);
  const date=new Date(dateNumber(from)*86400000),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+(scale==='quarter'?3:1));
  if(date.getUTCFullYear()>9999)return available;
  const last=new Date(date.getTime());last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);date.setUTCDate(Math.min(day,last.getUTCDate()));
  return Math.min(available,Math.max(1,date.getTime()/86400000-dateNumber(from)));
}
export function timelineDayLabels(from:string,days:number,dayWidth:number,mondayOnly=false){
  const weekly=mondayOnly||dayWidth<22;
  return Array.from({length:days},(_,offset)=>{const date=shiftDate(from,offset);return {date,offset,weekday:new Date(dateNumber(date)*86400000).getUTCDay()};}).filter(day=>!weekly||day.weekday===1);
}

export function timelineRange(from:string,anchor:number,current:number,days:number){
  const clamp=(index:number)=>Math.max(0,Math.min(days-1,index));
  return {start:shiftDate(from,Math.min(clamp(anchor),clamp(current))),end:shiftDate(from,Math.max(clamp(anchor),clamp(current)))};
}
export function timelineResize(row:PlanRow,days:number,mode:'move'|'start'|'end'){
  if(mode==='move')return dragDates(row,days,mode);
  return dragDates({...row,start:row.start??row.end,end:row.end??row.start},days,mode);
}
export function insertPlan(rows:PlanRow[],row:PlanRow,afterId?:string){
  const next=[...rows],index=afterId?next.findIndex(row=>row.id===afterId):-1;
  next.splice(index<0?next.length:index+1,0,row);return next;
}
export function monthBands(from:string,days:number){
  const bands:{offset:number;days:number;label:string}[]=[];
  for(let i=0;i<days;i++){
    const date=shiftDate(from,i),month=date.slice(0,7),last=bands.at(-1);
    if(last?.label===month)last.days++;else bands.push({offset:i,days:1,label:month});
  }
  return bands;
}
export function barGeometry(row:PlanRow,from:string,days:number,px:number){
  const start=row.start??row.end,end=row.end??row.start;if(!start||!end)return;
  const left=(dateNumber(start)-dateNumber(from))*px,right=(dateNumber(end)-dateNumber(from)+1)*px;
  return {left:Math.max(0,left),width:Math.max(0,Math.min(days*px,right)-Math.max(0,left)),outside:right<=0||left>=days*px};
}
