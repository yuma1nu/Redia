import {app,clipboard,dialog,nativeTheme} from 'electron';
import type {BrowserWindow} from 'electron';
import type {WorkspaceService} from '../src/main/service';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {emptyPlan,shiftDate} from '../src/shared/plans';
import {localToday} from '../src/shared/lists';
import assert from 'node:assert/strict';
export async function runPhase6(window:BrowserWindow,service:WorkspaceService,root:string,ui:(code:string)=>Promise<any>,stage='phase6'){
  if(stage==='phase6-restore'){
    const item=service.database.items().find(item=>item.title==='復元確認のページ')!;assert.ok(item);service.database.db.prepare('UPDATE items SET title=? WHERE id=?').run('復元前の変更',item.id);
    await ui(`click('設定');await wait(()=>document.querySelector('.backup-generations button'));`);
    dialog.showMessageBox=(async()=>({response:1,checkboxChecked:false})) as typeof dialog.showMessageBox;app.relaunch=()=>{};
    console.log('PHASE6_RESTORE_REQUESTED');await ui(`click('復元…');`);await new Promise(resolve=>setTimeout(resolve,10000));throw Error('Restore did not exit');
  }
  if(stage==='phase6-restored'){assert.ok(service.database.items().some(item=>item.title==='復元確認のページ'));assert.ok(!service.database.items().some(item=>item.title==='復元前の変更'));await ui(`click('復元確認のページ');await wait(()=>document.querySelector('#item-body img')?.naturalWidth>0);`);console.log('PHASE6_RESTART_RESTORED_WITH_IMAGE');return;}
  const item=service.database.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title:'復元確認のページ',themeId:null,originId:null}}).item!;
  const image=randomUUID();writeFileSync(join(root,'attachments',image+'.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
  service.database.commit({ref:{kind:'item',id:item.id},token:randomUUID(),baseRevision:item.revision,fields:{title:item.title,themeId:null,state:item.state,summary:'',body:'復元画像',bodyJson:JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'復元画像'}]},{type:'image',attrs:{src:`workspace-image://managed/${image}.png`}}]}),dueDate:null,reviewDate:null}});
  const today=localToday(),rows=Array.from({length:12},(_,i)=>({...emptyPlan(`報告用の長い日本語タイトルと折り返しの確認 ${i+1}${i===0?' 調査結果と測定条件を含む長文も省略せず表示します。':''}`),...(i%3?{start:today,end:today}:{})}));
  const token=randomUUID();service.plans.request({action:'stage',draft:{rows,baseRevision:0,token}});service.plans.request({action:'commit',token});
  await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.reload();});
  await ui(`click('計画');await wait(()=>document.querySelector('.timeline-grid'));click('画像をコピー');await wait(()=>document.querySelector('.report-preview canvas')?.width>0);if(document.querySelector('.form-error'))throw Error('Report error');`);
  const original=clipboard.write;let png:Uint8Array|undefined;clipboard.write=async data=>{png=new Uint8Array(await (await data[0].getType('image/png')).arrayBuffer());};
  try{await ui(`click('PNG画像をコピー');await wait(()=>document.body.textContent.includes('画像をコピーしました'));`);assert.ok(png&&png.length>1000);writeFileSync(join(root,'report.png'),png);
    await ui(`await input('.report-controls label:nth-child(3) input',${JSON.stringify(shiftDate(today,85))});click('PNG\u753b\u50cf\u3092\u30b3\u30d4\u30fc');await new Promise(resolve=>setTimeout(resolve,150));`);writeFileSync(join(root,'report-quarter.png'),png!);
    nativeTheme.themeSource='dark';await ui(`await new Promise(resolve=>setTimeout(resolve,150));click('PNG画像をコピー');`);writeFileSync(join(root,'report-dark-ui.png'),png!);
    await ui(`const checks=[...document.querySelectorAll('.report-row-options input')];for(const check of checks)check.click();await wait(()=>document.querySelector('.form-error'));if(![...document.querySelectorAll('button')].find(b=>b.textContent==='PNG画像をコピー').disabled)throw Error('Empty selection copy allowed');checks[0].click();await wait(()=>!document.querySelector('.form-error'));click('閉じる');`);
  }finally{clipboard.write=original;nativeTheme.themeSource='light';}
  const invalid=await ui(`return await window.workspace.copyPlanImage({png:'data:text/html,invalid'});`);assert.equal(invalid.ok,false);
  await ui(`click('設定');await wait(()=>document.querySelector('.backup-generations'));click('バックアップを作成');await wait(()=>document.querySelector('.backup-generations button'));`);
  const pick=dialog.showOpenDialog;dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[root+'-external-backups']})) as typeof dialog.showOpenDialog;
  try{await ui(`click('保存先を変更');await wait(()=>document.querySelector('.backup-directory').textContent.includes('-external-backups'));click('バックアップを作成');await wait(()=>document.querySelector('.backup-generations button'));`);}finally{dialog.showOpenDialog=pick;}
  const external=root+'-external-backups';renameSync(external,external+'-held');writeFileSync(external,'unavailable directory');
  try{const failed=await ui(`return await window.workspace.createBackup();`);assert.equal(failed.ok,false);const local=await ui(`return await window.workspace.getWorkspace();`);assert.equal(local.ok,true);service.database.db.prepare('UPDATE items SET summary=?').run('バックアップ失敗中もローカル編集');}finally{unlinkSync(external);renameSync(external+'-held',external);}
  const confirm=dialog.showMessageBox;dialog.showMessageBox=(async()=>({response:0,checkboxChecked:false})) as typeof dialog.showMessageBox;
  try{await ui(`click('復元…');await wait(()=>!document.querySelector('dialog'));`);}finally{dialog.showMessageBox=confirm;}
  const list=await ui(`return await window.workspace.backups({action:'list'});`);assert.ok(list.ok&&list.value.generations.length);
  await ui(`await new Promise(resolve=>setTimeout(resolve,300));`);writeFileSync(join(root,'phase6-settings.png'),(await window.webContents.capturePage()).toPNG());
  console.log('PHASE6_UI_OK report PNG, dark-independent rendering, empty rejection, backup create, choose directory, restore cancel');
}
