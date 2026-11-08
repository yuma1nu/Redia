import {barGeometry,monthBands,timelineDayLabels,groupPlanRows} from '../shared/timeline';
import {useEffect,useRef,useState} from 'react';
import {Modal} from './components';
import type {PlanRow} from '../shared/plans';
import {dateNumber,shiftDate,validPlanDate} from '../shared/plans';
import type {Theme} from '../shared/model';

export function PlanReport({rows,themes,from,initialTheme='all',initialDays=28,close}:{rows:PlanRow[];themes:Theme[];from:string;initialTheme?:string;initialDays?:number;close:()=>void}){
  const [theme,setTheme]=useState(initialTheme),[start,setStart]=useState(from),[end,setEnd]=useState(shiftDate(from,Math.min(initialDays-1,dateNumber('9999-12-31')-dateNumber(from)))),[width,setWidth]=useState(1600),[resolution,setResolution]=useState(1),[excluded,setExcluded]=useState<string[]>([]),[message,setMessage]=useState(''),[error,setError]=useState('');
  const canvas=useRef<HTMLCanvasElement>(null);
  const matches=(row:PlanRow)=>theme==='all'||row.themeId===(theme==='none'?null:theme);
  const selected=rows.filter(row=>matches(row)&&!excluded.includes(row.id));
  useEffect(()=>{try{
    if(!validPlanDate(start)||!validPlanDate(end)||end<start)throw Error('開始日と終了日を確認してください。');
    if(!selected.length)throw Error('出力する行を選択してください。');
    const days=dateNumber(end)-dateNumber(start)+1;if(days>366)throw Error('期間は366日以内にしてください。');
    const c=canvas.current!,ctx=c.getContext('2d')!;ctx.font='16px "Yu Gothic UI",sans-serif';
    const margin=20,plot=width-margin*2,dayWidth=plot/days;
    const layoutRow=(row:PlanRow)=>{
      const geometry=barGeometry(row,start,days,dayWidth),left=geometry&&!geometry.outside?geometry.left:0,x=margin+left+8;
      const lines=[''];for(const ch of row.title){if(ctx.measureText(lines.at(-1)!+ch).width>Math.max(16,width-margin-x))lines.push('');lines[lines.length-1]+=ch;}
      return {kind:'row' as const,row,geometry,x,lines,height:Math.max(44,lines.length*23+16)};
    };
    type Entry=ReturnType<typeof layoutRow>|{kind:'group';name:string;height:number}|{kind:'spacer';height:number};
    const layout:Entry[]=theme==='all'?groupPlanRows(selected,themes.filter(t=>!t.archived)).flatMap(group=>[{kind:'group' as const,name:group.name,height:32},...group.rows.map(layoutRow),{kind:'spacer' as const,height:36}]):selected.map(layoutRow);
    const height=100+layout.reduce((total,row)=>total+row.height,0);
    if(width*resolution>8192||height*resolution>8192||width*height*resolution*resolution>24000000)throw Error('\u753b\u50cf\u304c\u5927\u304d\u3059\u304e\u307e\u3059\u3002\u884c\u30fb\u30b5\u30a4\u30ba\u30fb\u89e3\u50cf\u5ea6\u3092\u6e1b\u3089\u3057\u3066\u304f\u3060\u3055\u3044\u3002');
    c.width=width*resolution;c.height=height*resolution;ctx.scale(resolution,resolution);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.font='16px "Yu Gothic UI",sans-serif';ctx.fillStyle='#242424';ctx.fillText('\u8a08\u753b',margin,26);
    for(let i=0;i<days;i++){const date=shiftDate(start,i),week=new Date(dateNumber(date)*86400000).getUTCDay();if(week===0||week===6){ctx.fillStyle='#f3f5f7';ctx.fillRect(margin+i*dayWidth,60,dayWidth,height-60);}}
    for(const band of monthBands(start,days)){if(band.days*dayWidth<32)continue;ctx.save();ctx.beginPath();ctx.rect(margin+band.offset*dayWidth,32,band.days*dayWidth,26);ctx.clip();ctx.fillStyle='#333';ctx.font='bold 16px "Yu Gothic UI",sans-serif';const label=band.days*dayWidth<115?Number(band.label.slice(5))+'\u6708':band.label.replace('-','\u5e74')+'\u6708';ctx.fillText(label,margin+band.offset*dayWidth+4,50);ctx.restore();}
    ctx.font='14px "Yu Gothic UI",sans-serif';ctx.textAlign='center';
    for(const {date,offset,weekday} of timelineDayLabels(start,days,dayWidth)){ctx.fillStyle=weekday===0?'#ad5555':weekday===6?'#527aa1':'#666';ctx.fillText(String(Number(date.slice(-2))),margin+(offset+.5)*dayWidth,78);}
    ctx.textAlign='left';ctx.font='16px "Yu Gothic UI",sans-serif';let y=90;
    for(const entry of layout){
      const h=entry.height;
      if(entry.kind==='group'){ctx.fillStyle='#f5f4f1';ctx.fillRect(margin,y,plot,h);ctx.fillStyle='#353535';ctx.font='bold 16px "Yu Gothic UI",sans-serif';ctx.fillText(entry.name,margin+8,y+22);ctx.font='16px "Yu Gothic UI",sans-serif';y+=h;continue;}
      if(entry.kind==='spacer'){y+=h;continue;}
      const {geometry,x,lines}=entry;
      if(geometry&&!geometry.outside){ctx.fillStyle='#e5ecf4';ctx.fillRect(margin+geometry.left,y+6,geometry.width,h-12);}
      ctx.fillStyle='#252525';lines.forEach((line,n)=>ctx.fillText(line,x,y+26+n*23));ctx.strokeStyle='#e8e8e8';ctx.beginPath();ctx.moveTo(margin,y+h);ctx.lineTo(width-margin,y+h);ctx.stroke();y+=h;
    }
    setError('');
  }catch(error){setError(error instanceof Error?error.message:'画像を生成できません。');}},[rows,theme,start,end,width,resolution,excluded]);
  async function copy(){setMessage('');try{const result=await window.workspace.copyPlanImage({png:canvas.current!.toDataURL('image/png')});setMessage(result.ok?'画像をコピーしました。PowerPointへ貼り付けできます。':result.error.message);}catch{setMessage('コピーできませんでした。再試行してください。');}}
  return <Modal title="計画画像をコピー" close={close}><div className="report-controls"><label>テーマ<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="all">すべて</option><option value="none">未所属</option>{themes.filter(t=>!t.archived).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>開始日<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>終了日<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><label>横幅<select value={width} onChange={e=>setWidth(Number(e.target.value))}>{[1200,1600,1920].map(w=><option key={w}>{w}</option>)}</select></label><label>解像度<select value={resolution} onChange={e=>setResolution(Number(e.target.value))}><option value="1">1倍</option><option value="2">2倍</option></select></label></div><details><summary>出力する行（{selected.length}件）</summary><div className="report-row-options">{rows.filter(matches).map(row=><label key={row.id}><input type="checkbox" checked={!excluded.includes(row.id)} onChange={e=>setExcluded(e.target.checked?excluded.filter(id=>id!==row.id):[...excluded,row.id])}/>{row.title}</label>)}</div></details>{error&&<p role="alert" className="form-error">{error}</p>}<div className="report-preview" hidden={!!error}><canvas ref={canvas} role="img" aria-label={`${theme==='all'?'テーマ別グループの':''}計画画像（${selected.length}行）`}/></div><p role="status">{message}</p><div className="modal-footer"><button onClick={close}>閉じる</button><button className="primary-button" disabled={!!error} onClick={()=>void copy()}>PNG画像をコピー</button></div></Modal>;
}
