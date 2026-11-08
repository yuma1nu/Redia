import type {BrowserWindow} from 'electron';
import {nativeTheme} from 'electron';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import type {WorkspaceService} from '../src/main/service';
import {DocumentRepository} from '../src/main/documents';
import {documentType} from '../src/shared/document-type';
import type {DocumentBatch} from '../src/shared/documents';

export async function runDocumentUpdates(window:BrowserWindow,service:WorkspaceService,root:string,stage:string,ui:(code:string)=>Promise<any>){
  const db=service.database,repo=new DocumentRepository(db),url='https://tenant.sharepoint.com/:p:/s/lab/REPORT?e=Keep';
  const wait=async(predicate:()=>boolean)=>{const start=Date.now();while(!predicate()){if(Date.now()-start>6000)throw Error('Document update DB wait timed out');await new Promise(resolve=>setTimeout(resolve,30));}};
  const find=(reference:string)=>repo.snapshot().documents.find(doc=>doc.reference===reference)!;
  const add=()=>ui(`click('資料を追加');await wait(()=>document.querySelector('#document-references'));`);
  const paste=(plain:string,html='')=>ui(`const field=document.querySelector('#document-references');field.focus();const data=new DataTransfer();data.setData('text/plain',${JSON.stringify(plain)});data.setData('text/html',${JSON.stringify(html)});if(field.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data})))document.execCommand('insertText',false,${JSON.stringify(plain)});await new Promise(resolve=>setTimeout(resolve,40));`);
  const shot=async(name:string)=>{nativeTheme.themeSource=name.includes('dark')?'dark':'light';await ui(`await new Promise(resolve=>setTimeout(resolve,220));`);writeFileSync(join(root,name),(await window.webContents.capturePage()).toPNG());};
  if(stage==='document-updates-restart'){
    assert.equal(find(url).name,'修正した報告書.pptx');
    await ui(`click('資料目録');await wait(()=>document.querySelector('[aria-label="資料の種類"]'));if(document.querySelector('[aria-label="資料の種類"]').value!=='pdf')throw Error('Derived filter lost after restart');if(document.querySelector('.save-status,.local-indicator'))throw Error('Normal save state remains');`);
    for(const doc of repo.snapshot().documents.filter(doc=>documentType(doc)==='pdf'))await ui(`await wait(()=>document.querySelector('[data-document-id="${doc.id}"] [data-document-type=pdf]'));`);
    console.log('DOCUMENT_UPDATES_RESTART_OK');return;
  }
  const theme=db.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'資料UI確認'}}).theme!;
  const create=(title:string)=>db.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title,themeId:theme.id,originId:null}}).item!;
  const a=create('資料を管理するページ'),b=create('もう一つの参照元');
  const pdf=(await repo.request({action:'register',entries:[{reference:'https://example.com/manual.PDF?token=Keep',name:'装置手順書'}],context:{kind:'item',id:a.id}}) as DocumentBatch).registered[0];
  await repo.request({action:'attach',id:pdf,context:{kind:'item',id:b.id}});const use=repo.snapshot().uses.find(use=>use.contextId===b.id)!;
  await repo.request({action:'use',id:pdf,context:{kind:'item',id:b.id},revision:use.revision,memo:'別ページの用途は保持',group:'',position:use.position});
  const local=join(root,'analysis.XLSX');writeFileSync(local,'test only');await repo.request({action:'register',entries:[{reference:local},{reference:'https://example.com/picture.png',name:'画像'},{reference:'https://example.com/help',name:'Webリンク'}],context:{kind:'theme',id:theme.id}});
  await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',resolve);window.reload();});
  await ui(`await wait(()=>document.querySelector('.workspace[aria-busy="false"]'));if(document.querySelector('.save-status,.local-indicator'))throw Error('Normal save state remains');click('新規ページ');await wait(()=>document.querySelector('#create-title'));await input('#create-title','保存状態の表示確認');if(document.querySelector('dialog .fine-print')?.textContent)throw Error('Draft save label remains');click('閉じる');await wait(()=>!document.querySelector('dialog'));click('資料を管理するページ');await wait(()=>document.querySelector('#item-body'));if(!document.querySelector('[data-document-id="${pdf}"] [data-document-type=pdf]'))throw Error('Page icon missing');`);
  await add();await paste('報告書.pptx',`<a href="${url}">報告書.pptx</a>`);
  await ui(`if(document.querySelector('[aria-label="登録する資料のタイトル1"]').value!=='報告書.pptx')throw Error('Clipboard title missing');await input('[aria-label="登録する資料のタイトル1"]','修正した報告書.pptx');if(!document.querySelector('.document-registration-title [data-document-type=powerpoint]'))throw Error('Preview type missing');`);
  await shot('document-add-title-light.png');
  window.setSize(1100,700);window.webContents.setZoomFactor(1.25);await shot('document-add-title-125.png');
  await ui(`const dialog=document.querySelector('dialog'),field=document.querySelector('[aria-label="登録する資料のタイトル1"]'),footer=dialog.querySelector('.modal-footer');if(dialog.getBoundingClientRect().bottom>innerHeight+1||footer.getBoundingClientRect().bottom>innerHeight+1||field.getBoundingClientRect().top<0)throw Error('Title entry or footer clipped at 125%');`);
  window.webContents.setZoomFactor(1);window.setSize(1366,768);await ui(`click('登録する');await wait(()=>!document.querySelector('dialog'));`);await wait(()=>find(url)?.name==='修正した報告書.pptx');
  await add();await paste(url,`<a href="${url}">別のタイトル.docx</a>`);
  await ui(`const field=document.querySelector('[aria-label="登録する資料のタイトル1"]');if(!field.readOnly||field.value!=='修正した報告書.pptx'||!document.querySelector('.document-existing-message')?.textContent.includes('登録済み'))throw Error('Duplicate notice or existing name missing');`);await shot('document-add-existing-dark.png');
  const count=repo.snapshot().documents.length;await ui(`click('登録する');await wait(()=>!document.querySelector('dialog'));await wait(()=>document.querySelector('.document-message')?.textContent.includes('登録済み'));`);assert.equal(repo.snapshot().documents.length,count);assert.equal(find(url).name,'修正した報告書.pptx');
  await add();await paste('https://example.com/first.pdf\nhttps://example.com/second.docx');await ui(`await input('[aria-label="登録する資料のタイトル1"]','一つ目の資料');await input('[aria-label="登録する資料のタイトル2"]','二つ目の資料');click('登録する');await wait(()=>!document.querySelector('dialog'));`);assert.equal(find('https://example.com/first.pdf').name,'一つ目の資料');assert.equal(find('https://example.com/second.docx').name,'二つ目の資料');
  // Detaching flushes the current memo first and uses its new revision.
  await ui(`await input('[data-document-id="${pdf}"] textarea','直前の入力も保護');`);await add();await ui(`click('条件を解除');await input('[aria-label="追加する資料を検索"]','装置手順書');await wait(()=>document.querySelectorAll('[data-picker-document]').length===1);click('装置手順書を解除');await wait(()=>document.querySelector('[data-picker-document] button')?.textContent.includes('追加'));if(!document.querySelector('dialog'))throw Error('Detach closed picker');`);
  assert.ok(!repo.snapshot().uses.some(use=>use.contextId===a.id&&use.documentId===pdf));assert.equal(repo.snapshot().uses.find(use=>use.contextId===b.id&&use.documentId===pdf)!.memo,'別ページの用途は保持');
  await ui(`click('装置手順書を追加');await wait(()=>document.querySelector('[data-picker-document] button')?.textContent.includes('解除'));`);
  db.db.exec(`CREATE TRIGGER fail_picker_detach BEFORE DELETE ON document_uses WHEN OLD.contextId='${a.id}' BEGIN SELECT RAISE(ABORT,'test'); END`);
  await ui(`click('装置手順書を解除');await wait(()=>document.querySelector('dialog [role=alert]'));if(!document.querySelector('[data-picker-document] button').textContent.includes('解除'))throw Error('Failed detach changed state');`);assert.ok(repo.snapshot().uses.some(use=>use.contextId===a.id&&use.documentId===pdf));db.db.exec('DROP TRIGGER fail_picker_detach');
  await ui(`click('装置手順書を解除');await wait(()=>document.querySelector('[data-picker-document] button')?.textContent.includes('追加'));click('装置手順書を追加');await wait(()=>document.querySelector('[data-picker-document] button')?.textContent.includes('解除'));click('閉じる');await wait(()=>!document.querySelector('dialog'));click('資料UI確認');await wait(()=>document.querySelector('[aria-label="テーマ名"]'));if(!document.querySelector('[data-document-id="${pdf}"] [data-document-type=pdf]'))throw Error('Theme icon missing');click('資料目録');await wait(()=>document.querySelector('[aria-label="資料の種類"]'));`);
  for(const doc of repo.snapshot().documents)await ui(`await wait(()=>document.querySelector('[data-document-id="${doc.id}"] [data-document-type="${documentType(doc)}"]'));`);
  await shot('document-types-light.png');await shot('document-types-dark.png');
  service.search.request({action:'remember',target:{kind:'document',id:find('https://example.com/help').id}});
  service.search.request({action:'remember',target:{kind:'document',id:pdf}});
  await ui(`click('検索');await wait(()=>document.querySelector('[aria-label="ワークスペースを検索"]'));await wait(()=>document.querySelector('.global-search-result .document-type-icon'));const icon=document.querySelector('.global-search-result .document-type-icon'),text=icon.nextElementSibling;if(icon.getBoundingClientRect().width>19||text.getBoundingClientRect().left-icon.getBoundingClientRect().right>12)throw Error('Recent document icon consumes text width');await input('[aria-label="ワークスペースを検索"]','修正した報告書');await wait(()=>document.querySelector('.global-search-result [data-document-type=powerpoint]'));if(document.querySelector('.global-search-result .document-type-icon').getBoundingClientRect().width>19)throw Error('Search document icon too wide');click('閉じる');await wait(()=>!document.querySelector('dialog'));await input('[aria-label="資料の種類"]','pdf');await wait(()=>document.querySelectorAll('[data-document-id]').length===2);`);
  await ui(`click('\u691c\u7d22');await wait(()=>document.querySelector('.global-search-result .document-type-icon'));`);await shot('recent-documents-light.png');await shot('recent-documents-dark.png');await ui(`click('\u9589\u3058\u308b');await wait(()=>!document.querySelector('dialog'));`);
  nativeTheme.themeSource='light';console.log('DOCUMENT_UPDATES_OK edited titles, duplicate notice, per-link detach, errors, all list icons, subtype filters');
}
