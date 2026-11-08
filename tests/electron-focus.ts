import type {BrowserWindow} from 'electron';
import type {WorkspaceService} from '../src/main/service';
import {DocumentRepository} from '../src/main/documents';
import assert from 'node:assert/strict';

export async function runModalFocus(window:BrowserWindow,service:WorkspaceService,ui:(code:string)=>Promise<unknown>){
  const db=service.database,docs=new DocumentRepository(db);
  const wait=async(predicate:()=>boolean)=>{const start=Date.now();while(!predicate()){if(Date.now()-start>6000)throw Error('Focus DB wait timed out');await new Promise(resolve=>setTimeout(resolve,30));}};
  const ready=async(selector:string)=>ui(`await wait(()=>document.querySelector('dialog[open]'));const field=document.querySelector(${JSON.stringify(selector)});if(!field||document.activeElement!==field)throw Error('Initial focus missing: '+${JSON.stringify(selector)}+'; got '+document.activeElement?.outerHTML);await new Promise(resolve=>setTimeout(resolve,150));if(document.activeElement!==field)throw Error('Initial focus moved away');`);
  const type=async(selector:string,text:string)=>{await ready(selector);await window.webContents.insertText(text);await ui(`await wait(()=>document.querySelector(${JSON.stringify(selector)}).value.includes(${JSON.stringify(text)}));`);};
  const closed=async()=>ui(`await wait(()=>!document.querySelector('dialog[open]'));`);
  await ui(`click('新規ページ');`);await type('#create-title','即入力のページ');await ui(`click('作成する');`);await closed();
  await wait(()=>db.items().some(item=>item.title==='即入力のページ'));
  await ui(`click('テーマを作成');`);await type('#create-title','即入力のテーマ');await ui(`click('作成する');`);await closed();
  await ui(`click('即入力のテーマ');await wait(()=>document.querySelector('[aria-label="テーマ名"]')?.value==='即入力のテーマ');click('新規ページ');`);await type('#create-title','テーマ内の即入力');await ui(`click('作成する');`);await closed();
  await ui(`click('資料を追加');`);await type('#document-references','https://example.com/focus-theme');await ui(`click('登録する');`);await closed();
  await ui(`click('テーマ内の即入力');await wait(()=>document.querySelector('#item-body'));click('資料を追加');`);await type('#document-references','https://example.com/focus-page');
  // Re-renders must not steal focus back from a search the user chose.
  await ui(`document.querySelector('[aria-label="追加する資料を検索"]').focus();`);await window.webContents.insertText('検索欄の入力');await ui(`await wait(()=>document.querySelector('[aria-label="追加する資料を検索"]').value==='検索欄の入力');if(document.activeElement!==document.querySelector('[aria-label="追加する資料を検索"]'))throw Error('Re-render stole input focus');click('登録する');`);await closed();
  await ui(`click('資料を追加');`);await ready('#document-references');await ui(`click('閉じる');`);await closed();
  await ui(`click('ページを追加');`);await type('#related-page-title','関連から即入力');await ui(`click('作成して追加');`);await closed();
  await ui(`click('資料目録');await wait(()=>document.querySelector('h1')?.textContent==='資料目録');click('資料を追加');`);await type('#document-references','https://example.com/focus-catalog');await ui(`click('登録する');`);await closed();
  assert.ok(docs.snapshot().documents.some(doc=>doc.reference==='https://example.com/focus-catalog'));
  await ui(`click('計画');await wait(()=>document.querySelector('.plans-page'));click('+ New');await wait(()=>document.querySelector('.timeline-new-title'));if(document.activeElement!==document.querySelector('.timeline-new-title'))throw Error('Inline plan title focus missing');`);
  await window.webContents.insertText('即入力の計画行');window.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});
  await ui(`await wait(()=>!document.querySelector('.timeline-new-title'));`);await wait(()=>service.plans.snapshot().rows.some(row=>row.title==='即入力の計画行'));
  await ui(`click('HOME');await wait(()=>document.querySelector('h1')?.textContent==='HOME');click('即入力のページ');await wait(()=>document.querySelector('#item-body'));click('計画に追加');`);await ready('[aria-label="ページから作る計画行名"]');
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'a',modifiers:['control']});window.webContents.sendInputEvent({type:'keyUp',keyCode:'a',modifiers:['control']});await window.webContents.insertText('ページから即入力の計画');
  await ui(`await wait(()=>document.querySelector('[aria-label="ページから作る計画行名"]').value==='ページから即入力の計画');click('作成して追加');`);await closed();
  assert.ok(service.plans.snapshot().rows.some(row=>row.title==='ページから即入力の計画'));
  await ui(`click('計画');await wait(()=>document.querySelector('.plans-page'));click('+ New');await wait(()=>document.activeElement===document.querySelector('.timeline-new-title'));`);
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await ui(`await wait(()=>!document.querySelector('.timeline-new-title'));`);
  console.log('MODAL_FOCUS_OK HOME/theme pages, theme, related page, catalog/theme/page documents, plan, page-to-plan, reopen, no focus stealing');
}
