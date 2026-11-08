import {Fragment,useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {CSSProperties,PointerEvent as ReactPointerEvent} from 'react';
import type {Item,Theme} from '../shared/model';
import {isSubmitKey} from '../shared/model';
import {dateNumber,emptyPlan,movePlan,shiftDate,validPlanDate} from '../shared/plans';
import type {PlanRow} from '../shared/plans';
import {barGeometry,insertPlan,monthBands,timelineRange,timelineResize,timelineWindowDays,timelineDayLabels,groupPlanRows} from '../shared/timeline';
import {Modal} from './components';
import {Icon} from './icons';
import {PlanPages} from './plans';
import {planStore} from './plan-store';
import './plan-timeline.css';
import {PlanReport} from './plan-report';

type Gesture = {kind:'bar';row:PlanRow;mode:'move'|'start'|'end';x:number;scroll:number;moved:boolean;next:PlanRow}
  | {kind:'range';id?:string;anchor:number;current:number;scope?:string;themeId?:string|null;afterId?:string};
type RangePreview={id?:string;start:string;end:string;scope?:string};

export function Plans({themes,items,today,initialTheme,openItem}:{themes:Theme[];items:Item[];today:string;initialTheme?:string;openItem:(id:string)=>void}){
  const state=useSyncExternalStore(planStore.subscribe,planStore.getSnapshot),{theme,query,scale,from,selectedId}=state.view;
  const collapsed=!!state.view.listCollapsed,editable=state.loaded&&!state.recovery;
  const [panel,setPanel]=useState(false),[creating,setCreating]=useState<string>(),[linking,setLinking]=useState(false),[deleting,setDeleting]=useState(false);
  const [report,setReport]=useState(false);
  const [preview,setPreview]=useState<PlanRow>(),[range,setRange]=useState<RangePreview>(),[error,setError]=useState('');
  const creation=useRef<string|undefined>(undefined),chart=useRef<HTMLDivElement>(null),nameInput=useRef<HTMLInputElement>(null),gesture=useRef<Gesture|undefined>(undefined);
  const revealToday=useRef(false);const [todayRequest,setTodayRequest]=useState(0);
  const activeThemes=themes.filter(t=>!t.archived),archived=(row:PlanRow)=>!!themes.find(t=>t.id===row.themeId)?.archived;
  const rows=state.rows.filter(row=>!archived(row)&&(theme==='all'||row.themeId===(theme==='none'?null:theme))&&(!row.title.trim()||row.id===creating||row.title.normalize('NFKC').toLocaleLowerCase().includes(query.normalize('NFKC').toLocaleLowerCase())));
  const selected=state.rows.find(row=>row.id===selectedId),locked=scale==='quarter';
  const groups=theme==='all'?groupPlanRows(rows,activeThemes):[{id:theme,name:'',rows}];
  const visibleDays=timelineWindowDays(from,scale),px=1360/visibleDays/(scale==='month'?1.3:1);
  const days=Math.min(visibleDays*3,dateNumber('9999-12-31')-dateNumber(from)+1),width=px*days;
  const dates=timelineDayLabels(from,days,px,locked),bands=monthBands(from,days);
  const reportOffset=Math.min(days-1,Math.floor((chart.current?.scrollLeft??0)/px));
  const reportDays=Math.max(1,Math.min(366,days-reportOffset,Math.ceil(((chart.current?.clientWidth??1360)-(collapsed?0:220)+(chart.current?.scrollLeft??0)%px)/px)));
  const weekday=new Date(dateNumber(from)*86400000).getUTCDay();
  const gridStyle={gridTemplateColumns:collapsed?`${width}px`:`220px ${width}px`,'--day-width':`${px}px`,'--week-width':`${px*7}px`,'--weekend-offset':`${((6-weekday+7)%7)*px}px`} as CSSProperties;
  useEffect(()=>{if(initialTheme)planStore.patchView({theme:initialTheme});},[initialTheme]);
  useEffect(()=>{const element=chart.current;if(!element)return;const wheel=(event:WheelEvent)=>{
    if(event.ctrlKey)return;const delta=event.deltaX|| (event.shiftKey?event.deltaY:0);if(!delta)return;
    const before=element.scrollLeft;element.scrollLeft+=delta*(event.deltaMode===1?24:event.deltaMode===2?element.clientWidth:1);
    if(element.scrollLeft!==before)event.preventDefault();
  };element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);},[state.loaded]);
  useEffect(()=>{cancelGesture();},[scale,from]);
  useLayoutEffect(()=>{if(chart.current){chart.current.scrollLeft=state.view.scrollLeft;chart.current.scrollTop=state.view.scrollTop;}},[state.loaded]);
  useLayoutEffect(()=>{if(revealToday.current&&chart.current){revealToday.current=false;const element=chart.current;const target=Math.max(0,7*px-(element.clientWidth-(collapsed?0:220))/2);element.scrollLeft=target;planStore.patchView({scrollLeft:element.scrollLeft});}},[from,scale,collapsed,state.view.scrollLeft,todayRequest]);
  useLayoutEffect(()=>{if(creating)nameInput.current?.focus({preventScroll:true});},[creating,collapsed]);
  useEffect(()=>{if(!creating){const pending=state.rows.find(row=>!row.title.trim()&&!archived(row));if(pending){creation.current=pending.id;setCreating(pending.id);}}},[state.rows,creating]);
  function cancelGesture(){gesture.current=undefined;setPreview(undefined);setRange(undefined);}
  useEffect(()=>{
    const cancel=(event:KeyboardEvent)=>{if(event.key!=='Escape'||event.isComposing||document.querySelector('dialog[open]'))return;if(gesture.current){event.preventDefault();cancelGesture();}else if(panel){event.preventDefault();setPanel(false);}};
    window.addEventListener('keydown',cancel);window.addEventListener('blur',cancelGesture);
    return()=>{window.removeEventListener('keydown',cancel);window.removeEventListener('blur',cancelGesture);};
  },[panel]);
  useEffect(()=>{
    if(!panel)return;
    const outside=(event:MouseEvent)=>{
      const target=event.target;
      if(!(target instanceof Element)||document.querySelector('dialog[open]'))return;
      if(!target.closest('.plan-sidepanel,button,input,select,textarea,a,[contenteditable=true],[role=button],.timeline-track'))setPanel(false);
    };
    document.addEventListener('click',outside);
    return()=>document.removeEventListener('click',outside);
  },[panel]);
  function offsetFrom(amount:number){planStore.patchView({from:new Date(Math.max(dateNumber('0001-01-01'),Math.min(dateNumber('9999-12-31'),dateNumber(from)+amount))*86400000).toISOString().slice(0,10)});}
  function open(row:PlanRow){planStore.patchView({selectedId:row.id});setPanel(true);}
  function finishName(id:string,cancel=false){
    if(creation.current!==id)return;creation.current=undefined;setCreating(undefined);
    const latest=planStore.getSnapshot(),row=latest.rows.find(row=>row.id===id);if(!row)return;
    if(cancel||!row.title.trim())planStore.change(latest.rows.filter(row=>row.id!==id),false,false);
    else planStore.update(id,{title:row.title.trim()},false,false);
  }
  function addRow(dates?:{start:string;end:string},afterId?:string,themeId?:string|null){
    if(!editable)return;if(creation.current)finishName(creation.current);
    const after=afterId?planStore.getSnapshot().rows.find(row=>row.id===afterId):undefined;
    const row={...emptyPlan('',themeId!==undefined?themeId:after?after.themeId:theme==='all'||theme==='none'?null:theme),...dates};
    planStore.change(insertPlan(planStore.getSnapshot().rows,row,afterId),true);creation.current=row.id;setCreating(row.id);setPanel(false);
    planStore.patchView({selectedId:row.id});
  }
  function point(event:ReactPointerEvent<HTMLElement>){return Math.max(0,Math.min(days-1,Math.floor((event.clientX-event.currentTarget.getBoundingClientRect().left)/px)));}
  function beginRange(event:ReactPointerEvent<HTMLElement>,row?:PlanRow,group?:{scope:string;themeId:string|null;afterId?:string}){
    if(event.button!==0||!editable||locked||row&&(row.start||row.end))return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);const day=point(event);
    gesture.current={kind:'range',id:row?.id,anchor:day,current:day,...group};setRange({id:row?.id,scope:group?.scope,...timelineRange(from,day,day,days)});setError('');
  }
  function beginBar(event:ReactPointerEvent<HTMLElement>,row:PlanRow,mode:'move'|'start'|'end'){
    if(event.button!==0||!editable||row.id===creating)return;
    if(locked){event.preventDefault();event.stopPropagation();return;}
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current={kind:'bar',row,mode,x:event.clientX,scroll:chart.current?.scrollLeft??0,moved:false,next:row};setError('');
  }
  function moving(event:ReactPointerEvent<HTMLElement>){
    const current=gesture.current;if(!current)return;
    const scroll=chart.current;if(scroll){const box=scroll.getBoundingClientRect();if(event.clientX>box.right-28)scroll.scrollLeft+=12;else if(event.clientX<box.left+28)scroll.scrollLeft-=12;}
    try{
      if(current.kind==='bar'){
        const delta=event.clientX-current.x+(chart.current?.scrollLeft??0)-current.scroll;
        if(Math.abs(delta)>=3)current.moved=true;
        if(current.moved){current.next=timelineResize(current.row,Math.round(delta/px),current.mode);setPreview(current.next);}
      }else{current.current=point(event);setRange({id:current.id,scope:current.scope,...timelineRange(from,current.anchor,current.current,days)});}
    }catch(error){setError(error instanceof Error?error.message:'日付を確認してください。');}
  }
  function finish(){
    const current=gesture.current;gesture.current=undefined;setPreview(undefined);setRange(undefined);if(!current)return;
    if(current.kind==='bar'){
      if(current.moved)planStore.update(current.row.id,{start:current.next.start,end:current.next.end});
      else if(current.mode==='move')open(current.row);
    }else{
      const dates=timelineRange(from,current.anchor,current.current,days);
      if(current.id)planStore.update(current.id,dates,current.id===creation.current);
      else addRow(dates,current.afterId,current.themeId);
    }
  }
  const pointerProps={onPointerMove:moving,onPointerUp:finish,onPointerCancel:cancelGesture,onLostPointerCapture:()=>{if(gesture.current)cancelGesture();}};
  function titleInput(row:PlanRow){return <input ref={nameInput} className="timeline-new-title" aria-label="新しい計画行のタイトル" placeholder="タイトルを入力…" value={row.title} onPointerDown={event=>event.stopPropagation()}
    onChange={event=>planStore.update(row.id,{title:event.target.value},true,false)} onBlur={()=>finishName(row.id)} onKeyDown={event=>{
      if(event.key==='Enter'&&isSubmitKey(event.nativeEvent)){event.preventDefault();finishName(row.id);}
      if(event.key==='Escape'&&!event.nativeEvent.isComposing){event.preventDefault();event.stopPropagation();finishName(row.id,true);}
    }}/>;}
  function bar(row:PlanRow){
    const current=preview?.id===row.id?preview:range?.id===row.id?{...row,start:range.start,end:range.end}:row;
    if(current.start&&!validPlanDate(current.start)||current.end&&!validPlanDate(current.end))return <span className="timeline-date-error">日付を確認してください</span>;
    const geometry=barGeometry(current,from,days,px);
    if(!geometry)return collapsed&&row.id===creating?<div className="timeline-undated-input" style={{left:state.view.scrollLeft+12}}>{titleInput(row)}</div>:null;
    if(geometry.outside)return <button className="timeline-outside" onClick={()=>{planStore.patchView({from:current.start??current.end!});}} title={current.title}>{current.title||'無題'} ↗</button>;
    return <div className="timeline-bar" role="button" tabIndex={0} aria-label={`${row.title||'新しい行'}の日程 ${current.start??'未定'}〜${current.end??'未定'}`} title={`${row.title} ${current.start??'未定'}〜${current.end??'未定'}`} style={{left:geometry.left,width:geometry.width}}
      onPointerDown={event=>beginBar(event,row,'move')} onClick={locked?()=>open(row):undefined} {...pointerProps} onKeyDown={event=>{
        if(row.id===creating)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();open(row);}
        else if(['ArrowLeft','ArrowRight'].includes(event.key)&&editable){event.preventDefault();try{const next=timelineResize(row,event.key==='ArrowRight'?1:-1,event.shiftKey?'end':'move');planStore.update(row.id,{start:next.start,end:next.end});}catch(error){setError(String(error));}}
      }}>
      <span className="timeline-bar-background"/>
      <span className="timeline-bar-label">{collapsed&&row.id===creating?titleInput(row):row.title||'タイトルを入力…'}</span>
      {row.id!==creating&&!locked&&<><span className="timeline-resize start" role="button" aria-label={`${row.title}の開始を伸縮`} onPointerDown={event=>beginBar(event,row,'start')}/><span className="timeline-resize end" role="button" aria-label={`${row.title}の終了を伸縮`} onPointerDown={event=>beginBar(event,row,'end')}/></>}
    </div>;
  }
  function rangeBar(id?:string,scope?:string){if(!range||range.id!==id||range.scope!==scope)return null;const geometry=barGeometry({...emptyPlan(''),...range},from,days,px)!;return <span className="timeline-range-preview" style={{left:geometry.left,width:geometry.width}}/>;}
  return <article className={`plans-page page-content ${panel&&selected?'has-plan-panel':''} ${locked?'timeline-locked':''}`} tabIndex={-1} onKeyDown={event=>{
    if(event.ctrlKey&&!event.nativeEvent.isComposing&&event.key.toLowerCase()==='z'&&!(event.target as HTMLElement).closest('input,textarea,[contenteditable=true],dialog')){event.preventDefault();if(event.shiftKey)planStore.redo();else planStore.undo();}
  }}>
    <header className="page-header"><div className="page-emblem"><Icon name="plan" size={28}/></div><h1>計画</h1></header>
    <div className="plan-tools"><div className="list-search"><Icon name="search" size={16}/><input aria-label="計画行を検索" placeholder="計画行を検索" value={query} onChange={event=>planStore.patchView({query:event.target.value})}/></div>
      <select aria-label="計画のテーマ" value={theme} onChange={event=>{planStore.patchView({theme:event.target.value,selectedId:null});setPanel(false);}}><option value="all">すべてのテーマ</option><option value="none">未所属</option>{activeThemes.map(theme=><option key={theme.id} value={theme.id}>{theme.name}</option>)}</select>
      <button onClick={()=>setReport(true)} disabled={!editable}>画像をコピー</button><span className="plan-undo"><button disabled={!state.undo||!editable} onClick={()=>planStore.undo()} title="元に戻す（Ctrl+Z）">元に戻す</button><button disabled={!state.redo||!editable} onClick={()=>planStore.redo()}>やり直す</button></span>
    </div>
    <div className="plan-tools timeline-tools"><button className="timeline-collapse" aria-label={collapsed?'タイトル列を表示':'タイトル列を折りたたむ'} aria-expanded={!collapsed} onClick={()=>planStore.patchView({listCollapsed:!collapsed})}>{collapsed?'»':'«'}</button>
      <button aria-label="前の期間" onClick={()=>offsetFrom(-Math.max(1,Math.floor(visibleDays/2)))}>‹</button><button onClick={()=>{revealToday.current=true;setTodayRequest(n=>n+1);planStore.patchView({from:shiftDate(today,-7),scrollLeft:0});}}>今日</button><button aria-label="次の期間" onClick={()=>offsetFrom(Math.max(1,Math.floor(visibleDays/2)))}>›</button>
      <input aria-label="ガントの表示開始日" type="date" value={from} onChange={event=>{if(validPlanDate(event.target.value))planStore.patchView({from:event.target.value});}}/>
      <select aria-label="ガントの表示単位" value={scale} onChange={event=>planStore.patchView({scale:event.target.value as typeof scale})}><option value="week">週</option><option value="month">月</option><option value="quarter">クオーター</option></select>
      {locked&&<span className="fine-print">日程操作はロック中（詳細で編集）</span>}
      {(preview||range)&&<span className="timeline-preview-dates" role="status">{(preview??range)?.start}〜{(preview??range)?.end}</span>}
    </div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {!state.loaded?<p>計画を読み込んでいます…</p>:<div className="timeline-scroll" ref={chart} aria-label="計画のタイムライン" onScroll={event=>planStore.patchView({scrollLeft:event.currentTarget.scrollLeft,scrollTop:event.currentTarget.scrollTop})}>
      <div className="timeline-grid" style={gridStyle}>
        {!collapsed&&<div className="timeline-name timeline-heading">タイトル</div>}
        <div className="timeline-axis"><div className="timeline-months">{bands.filter(band=>band.days*px>=32).map(band=><span key={band.offset} title={band.label.replace('-','年')+'月'} style={{left:band.offset*px,width:band.days*px}}>{band.days*px<110?Number(band.label.slice(5)):band.label.replace('-','年')}月</span>)}</div><div className="timeline-days">{dates.map(({date,offset:index,weekday})=>{return <span key={date} data-date={date} className={weekday===0?'sunday':weekday===6?'saturday':undefined} style={{left:index*px,width:px}}>{Number(date.slice(-2))}</span>;})}</div></div>
        {groups.map(group=><Fragment key={group.id??'unassigned'}>
          {theme==='all'&&<>{!collapsed&&<div className="timeline-name timeline-group" data-plan-group={group.id??'none'} role="heading" aria-level={3}><Icon name="folder" size={15}/><span>{group.name}</span><small>{group.rows.length}</small></div>}<div className="timeline-group-calendar">{collapsed&&<span role="heading" aria-level={3}>{group.name}<small>{group.rows.length}</small></span>}</div></>}
        {group.rows.map(row=><Fragment key={row.id}>
          {!collapsed&&<div className="timeline-name" data-plan-id={row.id} onDragOver={event=>{if(editable)event.preventDefault();}} onDrop={event=>{event.preventDefault();if(!editable)return;const source=planStore.getSnapshot().rows.find(row=>row.id===event.dataTransfer.getData('application/x-plan-row'));if(source&&source.themeId===row.themeId)planStore.change(movePlan(planStore.getSnapshot().rows,source.id,row.id));}}>
            <button className="timeline-insert icon-button" aria-label={`${row.title||'新しい行'}の下に挿入`} disabled={!editable} onMouseDown={event=>event.preventDefault()} onClick={()=>addRow(undefined,row.id)}><Icon name="plus" size={14}/></button>
            <button className="plan-grip" draggable={editable} aria-label={`${row.title}を並べ替え`} onDragStart={event=>event.dataTransfer.setData('application/x-plan-row',row.id)}>⠿</button>
            {row.id===creating?titleInput(row):<button className="plan-row-title" title={row.title} onClick={()=>open(row)}><Icon name="file" size={15}/><span>{row.title}</span></button>}
          </div>}
          <div className="timeline-track" data-plan-id={row.id} aria-label={`${row.title||'新しい行'}のカレンダー`} onPointerDown={event=>beginRange(event,row)} {...pointerProps}>
            {bar(row)}{!row.start&&!row.end&&rangeBar(row.id)}<span className="timeline-today" style={{left:(dateNumber(today)-dateNumber(from)+.5)*px}}/>
          </div>
        </Fragment>)}
        {theme==='all'&&<>{!collapsed&&<div className="timeline-name timeline-new"><button className="text-button" aria-label={`${group.name}に計画行を追加`} disabled={!editable} onClick={()=>addRow(undefined,group.rows.at(-1)?.id,group.id)}>+ New</button></div>}<div className="timeline-track timeline-new" aria-label={`${group.name}の空欄カレンダーから計画行を作成`} onPointerDown={event=>beginRange(event,undefined,{scope:group.id??'none',themeId:group.id,afterId:group.rows.at(-1)?.id})} {...pointerProps}>{rangeBar(undefined,group.id??'none')}</div></>}
        </Fragment>)}
        {(theme!=='all'||!groups.length)&&<>{!collapsed&&<div className="timeline-name timeline-new"><button className="text-button" disabled={!editable} onClick={()=>addRow()}>+ New</button></div>}
        <div className="timeline-track timeline-new" aria-label="空欄のカレンダーから計画行を作成" onPointerDown={event=>beginRange(event)} {...pointerProps}>
          {rangeBar()}
        </div></>}
      </div>
    </div>}
    {panel&&selected&&!archived(selected)&&<PlanPanel key={selected.id} row={selected} themes={activeThemes} items={items} editable={editable} close={()=>setPanel(false)} openItem={openItem} link={()=>setLinking(true)} remove={()=>setDeleting(true)}/>}
    {report&&<PlanReport rows={state.rows.filter(row=>!archived(row)&&(!query||row.title.normalize('NFKC').toLocaleLowerCase().includes(query.normalize('NFKC').toLocaleLowerCase())))} themes={themes} initialTheme={theme} from={shiftDate(from,reportOffset)} initialDays={reportDays} close={()=>setReport(false)}/>}
    {linking&&selected&&<PlanPages row={selected} themes={themes} items={items} close={()=>setLinking(false)}/>}
    {deleting&&selected&&<Modal title="計画行を削除しますか？" close={()=>setDeleting(false)}><p>「{selected.title}」の日程と計画上の関連を削除します。関連するページは保持します。</p><div className="modal-footer"><button onClick={()=>setDeleting(false)}>戻る</button><button onClick={()=>{planStore.change(planStore.getSnapshot().rows.filter(row=>row.id!==selected.id));setPanel(false);setDeleting(false);}}>削除する</button></div></Modal>}
  </article>;
}

function PlanPanel({row,themes,items,editable,close,openItem,link,remove}:{row:PlanRow;themes:Theme[];items:Item[];editable:boolean;close:()=>void;openItem:(id:string)=>void;link:()=>void;remove:()=>void}){
  const title=useRef<HTMLInputElement>(null);useLayoutEffect(()=>{title.current?.focus({preventScroll:true});},[]);
  return <aside className="plan-sidepanel" role="dialog" aria-modal="false" aria-label="計画行の詳細"><header><span>計画行</span><div><button className="icon-button" disabled={!editable} aria-label="計画行を削除" onClick={remove}><Icon name="trash" size={17}/></button><button className="icon-button" aria-label="計画の詳細を閉じる" onClick={close}><Icon name="close" size={19}/></button></div></header>
    <label className="plan-panel-title">タイトル<input ref={title} aria-label="計画行名" value={row.title} disabled={!editable} onChange={event=>planStore.update(row.id,{title:event.target.value},(event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={event=>planStore.update(row.id,{title:event.currentTarget.value})}/></label>
    <div className="plan-panel-properties"><label><Icon name="folder" size={15}/>テーマ<select aria-label="計画行の所属テーマ" disabled={!editable} value={row.themeId??''} onChange={event=>planStore.update(row.id,{themeId:event.target.value||null})}><option value="">未所属</option>{themes.map(theme=><option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
      {(['start','end'] as const).map((field,index)=><label key={field}><Icon name="calendar" size={15}/>{index?'終了日':'開始日'}<input type="date" aria-label={field} disabled={!editable} value={row[field]??''} onChange={event=>planStore.update(row.id,{[field]:event.target.value||null})}/></label>)}
    </div><section className="plan-panel-pages"><h2>関連付けられたページ</h2>{row.itemIds.map(id=><div key={id}><button className="page-link" onClick={()=>openItem(id)}><Icon name="file" size={15}/><span>{items.find(item=>item.id===id)?.title??'ページ'}</span></button><button className="icon-button" disabled={!editable} aria-label={`${id}の計画関連を解除`} onClick={()=>planStore.update(row.id,{itemIds:row.itemIds.filter(other=>other!==id)})}><Icon name="close" size={14}/></button></div>)}<button className="text-button" disabled={!editable} onClick={link}><Icon name="plus" size={15}/>ページを関連付け</button></section>
  </aside>;
}
