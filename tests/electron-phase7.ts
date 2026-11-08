import {nativeTheme} from 'electron';
import type {BrowserWindow} from 'electron';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {writeFileSync} from 'node:fs';
import type {WorkspaceService} from '../src/main/service';
import {DocumentRepository} from '../src/main/documents';
import {emptyPlan,shiftDate} from '../src/shared/plans';
import {localToday} from '../src/shared/lists';

export async function seedPhase7(window:BrowserWindow,service:WorkspaceService){
  const db=service.database,today=localToday();
  const theme=db.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'初期版の確認'}}).theme!;
  const create=(title:string)=>db.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title,themeId:theme.id,originId:null}}).item!;
  const page=create('測定条件と結果を整理する');create('報告資料をまとめる');
  const bodyJson=JSON.stringify({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'測定条件'}]},{type:'paragraph',content:[{type:'text',text:'環境温度と装置の設定を確認してから測定する。結果と判断の理由を、関連資料と一緒に残す。'}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'測定レンジと校正日を確認'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'前回との比較を整理'}]}]}]}]});
  db.commit({ref:{kind:'item',id:page.id},token:randomUUID(),baseRevision:page.revision,fields:{title:page.title,themeId:theme.id,state:'進行中',summary:'測定条件を確認し、結果をまとめる',body:'測定条件\n環境温度と装置の設定を確認する',bodyJson,dueDate:shiftDate(today,7),reviewDate:today}});
  const docs=new DocumentRepository(db);await docs.request({action:'register',entries:[{reference:'https://example.com/manual.pdf',name:'装置の手順書'},{reference:'https://example.com/report.pptx',name:'報告用スライド'},{reference:'https://example.com/results.xlsx',name:'測定結果の比較表'}],context:{kind:'item',id:page.id}});
  const rows=['条件の整理','装置の準備と校正確認','測定と結果の比較','報告資料の作成','次の確認事項'].map((title,i)=>({...emptyPlan(title,theme.id,i===0?[page.id]:[]),...(i===4?{}:{start:shiftDate(today,i*4),end:shiftDate(today,i*4+5)})}));
  const token=randomUUID();service.plans.request({action:'stage',draft:{rows,baseRevision:0,token}});service.plans.request({action:'commit',token});
  await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',resolve);window.reload();});
  window.setTitle('Redia — Phase 7 テスト');return {theme,page,rows};
}
export async function runPhase7Layout(window:BrowserWindow,service:WorkspaceService,root:string,ui:(code:string)=>Promise<any>){
  const {theme,page}=await seedPhase7(window,service);const results=[];
  for(const [width,height] of [[1366,768],[1920,1080]])for(const zoom of [1,1.25,1.5])for(const color of ['light','dark'] as const){
    window.webContents.setZoomFactor(zoom);window.setSize(width,height);nativeTheme.themeSource=color;
    const prefix=`${width}x${height}-${Math.round(zoom*100)}-${color}`;
    const shot=async(name:string)=>{await ui(`await new Promise(resolve=>setTimeout(resolve,100));`);writeFileSync(join(root,`${prefix}-${name}.png`),(await window.webContents.capturePage()).toPNG());};
    const check=()=>ui(`const root=document.querySelector('.workspace'),main=document.querySelector('main');if(root.scrollWidth>root.clientWidth+1||main.scrollWidth>main.clientWidth+1)throw Error('Outer horizontal overflow');for(const dialog of document.querySelectorAll('dialog[open]')){const r=dialog.getBoundingClientRect();if(r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)throw Error('Dialog outside viewport');}if(document.querySelector('.save-status:not(.error-text)'))throw Error('Normal save status remains');`);
    await ui(`click('HOME');await wait(()=>document.querySelector('h1')?.textContent==='HOME');`);await check();await shot('home');
    await ui(`click(${JSON.stringify(theme.name)});await wait(()=>document.querySelector('[aria-label="テーマ名"]'));`);await check();await shot('theme');
    await ui(`click(${JSON.stringify(page.title)});await wait(()=>document.querySelector('#item-body'));`);await check();await shot('page');
    await ui(`click('資料を追加');await wait(()=>document.querySelector('#document-references'));await input('#document-references','https://example.com/new-report.pptx');`);await check();
    const checkPicker=()=>ui(`const dialog=document.querySelector('.document-picker-dialog'),list=document.querySelector('.document-picker-list'),footer=dialog.querySelector('.modal-footer'),register=dialog.querySelector('.document-register-area');if(list.getBoundingClientRect().bottom>footer.getBoundingClientRect().top+1)throw Error('Picker list overlaps footer');if(list.clientHeight<30)throw Error('Picker list is not usable');if(register.getBoundingClientRect().bottom>document.querySelector('.document-choose-area').getBoundingClientRect().top+1)throw Error('Registration overlaps picker');if(dialog.scrollHeight>dialog.clientHeight+1)throw Error('Picker outer overflow');`);
    await checkPicker();await ui(`const field=document.querySelector('.document-registration-title-field input').getBoundingClientRect(),area=document.querySelector('.document-register-area').getBoundingClientRect();if(field.bottom>area.bottom+1)throw Error('Single title is clipped '+JSON.stringify({width:innerWidth,height:innerHeight,field:field.toJSON(),area:area.toJSON()}));`);await shot('document-add');
    await ui(`await input('#document-references',Array.from({length:10},(_,i)=>'https://example.com/report-'+i+'.pdf').join('\\n'));await wait(()=>document.querySelectorAll('.document-registration-title-field input').length===10);const entry=document.querySelector('.document-reference-entry').getBoundingClientRect(),titles=document.querySelector('.document-registration-titles').getBoundingClientRect();if(titles.top<entry.bottom-1)throw Error('Registration titles overlap reference entry');`);await check();await checkPicker();await shot('document-add-multiple');
    await ui(`click('閉じる');await wait(()=>!document.querySelector('dialog'));click('資料目録');await wait(()=>document.querySelector('[aria-label="資料の種類"]'));`);await check();await shot('catalog');
    await ui(`click('計画');await wait(()=>document.querySelector('.timeline-grid'));`);await check();await shot('plans');
    await ui(`click('画像をコピー');await wait(()=>document.querySelector('.report-preview canvas')?.width>0);`);await check();await shot('report');await ui(`click('閉じる');await wait(()=>!document.querySelector('dialog'));`);
    results.push({width,height,zoom,color,pass:true});
  }
  writeFileSync(join(root,'layout-results.json'),JSON.stringify(results,null,2));window.webContents.setZoomFactor(1);nativeTheme.themeSource='light';console.log('PHASE7_LAYOUT_OK 12 size/zoom/color combinations, 8 surfaces');
}
