import type {BrowserWindow} from 'electron';
import {nativeTheme} from 'electron';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {DocumentRepository} from '../src/main/documents';
import type {WorkspaceService} from '../src/main/service';

export async function runClipboard(window:BrowserWindow,service:WorkspaceService,root:string,stage:string,ui:(code:string)=>Promise<unknown>){
  const docs=new DocumentRepository(service.database),db=service.database;
  const reference='https://tenant.sharepoint.com/:w:/s/lab/SHARING?e=TokenAbC';
  const wait=async(predicate:()=>boolean)=>{const start=Date.now();while(!predicate()){if(Date.now()-start>6000)throw Error('Clipboard main wait timed out');await new Promise(resolve=>setTimeout(resolve,30));}};
  const find=(url:string)=>docs.snapshot().documents.find(doc=>doc.reference===url)!;
  const key=async(keyCode:string,modifiers:('control'|'shift')[]=[])=>{window.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});window.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await new Promise(resolve=>setTimeout(resolve,50));};
  const paste=async(plain:string,html='')=>ui(`const field=document.querySelector('#document-references');field.focus();const data=new DataTransfer();data.setData('text/plain',${JSON.stringify(plain)});if(${JSON.stringify(html)})data.setData('text/html',${JSON.stringify(html)});const normal=field.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));if(normal)document.execCommand('insertText',false,${JSON.stringify(plain)});await new Promise(resolve=>setTimeout(resolve,50));`);
  const add=async()=>ui(`click('資料を追加');await wait(()=>document.querySelector('#document-references'));`);
  const register=async()=>ui(`click('登録する');await wait(()=>!document.querySelector('dialog'));`);
  if(stage==='clipboard-create'){
    const theme=db.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'貼り付けの確認'}}).theme!;
    const item=db.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title:'リンクを貼り付けるページ',themeId:theme.id,originId:null}}).item!;
    await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.reload();});
    let network=0;window.webContents.session.webRequest.onBeforeRequest({urls:['*://clipboard-test.invalid/*']},(_details,callback)=>{network++;callback({cancel:true});});
    await ui(`await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));click('リンクを貼り付けるページ');await wait(()=>document.querySelector('#item-body'));`);await add();
    await paste('試験計画書.docx',`<html><head><style>p{color:red}</style></head><body><!--StartFragment--><script>globalThis.__clipboardExecuted=true</script><img src="https://clipboard-test.invalid/image" onerror="globalThis.__clipboardExecuted=true"><iframe src="https://clipboard-test.invalid/frame"></iframe><a href="${reference}"><b>試験計画書.docx</b></a><!--EndFragment--></body></html>`);
    await ui(`if(document.querySelector('#document-references').value!==${JSON.stringify(reference)}||!document.querySelector('[aria-label="登録する資料のタイトル1"]')?.value.includes('試験計画書.docx'))throw Error('Office link name or URL lost');if(globalThis.__clipboardExecuted||document.querySelector('a[href*="SHARING"],img[src*=clipboard-test]'))throw Error('Clipboard HTML entered the live document');`);
    nativeTheme.themeSource='light';await new Promise(resolve=>setTimeout(resolve,180));writeFileSync(join(root,'clipboard-name-preview.png'),(await window.webContents.capturePage()).toPNG());
    await register();await wait(()=>!!find(reference));assert.equal(find(reference).name,'試験計画書.docx');assert.ok(docs.snapshot().uses.some(use=>use.documentId===find(reference).id&&use.contextId===item.id));
    await ui(`if(document.querySelector('.item-title').value!=='リンクを貼り付けるページ')throw Error('Registration navigated away');`);
    const document=find(reference);await docs.request({action:'edit',id:document.id,revision:document.revision,name:'自分で付けた資料名',reference,kind:'url',description:''});
    await add();await paste(reference,`<a href="${reference}">上書きしてはいけない名前.docx</a>`);await register();assert.equal(find(reference).name,'自分で付けた資料名');
    await ui(`click('資料目録');await wait(()=>document.querySelector('[aria-label="資料を検索"]'));`);await add();
    const web='https://example.com/web-title';await paste(web,`<a href="${web}">日本語のWebページ</a>`);
    await ui(`if(!document.querySelector('[aria-label="登録する資料のタイトル1"]')?.value.includes('日本語のWebページ'))throw Error('URL-only text lost HTML title');`);
    await key('z',['control']);await ui(`if(document.querySelector('#document-references').value)throw Error('Native paste undo failed');`);await key('y',['control']);
    await ui(`if(document.querySelector('#document-references').value!==${JSON.stringify(web)})throw Error('Paste redo failed');`);await register();assert.equal(find(web).name,'日本語のWebページ');
    // Rich-label insertion into an existing textarea also preserves undo/redo and other lines.
    const original=join(root,'temporary-manual.txt');writeFileSync(original,'original unchanged');
    await add();await ui(`await input('#document-references',${JSON.stringify(original+'\n')});const field=document.querySelector('#document-references');field.focus();field.setSelectionRange(field.value.length,field.value.length);`);
    const a='https://tenant.sharepoint.com/:x:/s/lab/SHEET?e=A',b='https://tenant.sharepoint.com/:p:/s/lab/SLIDES?e=B';
    await paste('比較表.xlsx\n報告資料.pptx',`<a href="${a}">比較表.xlsx</a><br><a href="${b}">報告資料.pptx</a>`);
    await ui(`if(document.querySelector('#document-references').value!==${JSON.stringify(original+'\n'+a+'\n'+b)})throw Error('Mixed reference insertion lost a line');`);
    await key('z',['control']);await ui(`if(document.querySelector('#document-references').value!==${JSON.stringify(original+'\n')})throw Error('Rich paste undo lost earlier input');`);await key('y',['control']);await register();
    assert.equal(find(a).name,'比較表.xlsx');assert.equal(find(b).name,'報告資料.pptx');assert.equal(readFileSync(original,'utf8'),'original unchanged');
    const safe='https://example.com/visible-url';await add();await paste(safe,'<a href="https://clipboard-test.invalid/hidden">違う参照先</a>');await ui(`if(document.querySelector('#document-references').value!==${JSON.stringify(safe)}||document.querySelector('[aria-label="登録する資料のタイトル1"]')?.value!=='visible-url')throw Error('HTML overrode visible URL');`);await register();assert.equal(find(safe).name,'visible-url');assert.ok(!find('https://clipboard-test.invalid/hidden'));
    await add();await paste('https://example.com/plain');await register();assert.equal(find('https://example.com/plain').name,'plain');
    await add();await paste('https://example.com/bounded',`<a href="https://example.com/bounded">${'長'.repeat(513)}</a>`);await register();assert.equal(find('https://example.com/bounded').name,'bounded');
    await add();await paste('https://example.com/large',' '.repeat(1024*1024)+'<a href="https://example.com/large">採用しない</a>');await register();assert.equal(find('https://example.com/large').name,'large');
    // An unsafe anchor cannot be converted into a registered URL.
    await add();await paste('危険なリンク','<a href="javascript:alert(1)">危険なリンク</a>');await register();await ui(`await wait(()=>document.querySelector('.document-failures'));await input('[aria-label="再試行する参照先1"]','');`);
    const retry='https://tenant.sharepoint.com/:w:/s/lab/RETRY?e=Keep',change='https://tenant.sharepoint.com/:w:/s/lab/CHANGE?e=Old';
    db.db.exec("CREATE TRIGGER fail_clipboard BEFORE INSERT ON documents WHEN NEW.reference LIKE '%/RETRY?%' OR NEW.reference LIKE '%/CHANGE?%' BEGIN SELECT RAISE(ABORT,'test'); END");
    await add();await paste('再試行用.docx\n変更前.docx',`<a href="${retry}">再試行用.docx</a><br><a href="${change}">変更前.docx</a>`);await register();await ui(`await wait(()=>document.querySelectorAll('.document-failures input').length===2);`);
    db.db.exec('DROP TRIGGER fail_clipboard');await ui(`await input('[aria-label="再試行する参照先2"]','https://example.com/replaced');click('失敗した資料だけ再試行');await wait(()=>!document.querySelector('.document-failures'));`);
    await wait(()=>!!find(retry));assert.equal(find(retry).name,'再試行用.docx');assert.equal(find('https://example.com/replaced').name,'replaced');assert.equal(network,0);
    window.webContents.session.webRequest.onBeforeRequest(null);
    console.log('CLIPBOARD_PASTE_OK names, URLs, native undo, batch, retry, existing names, inert HTML, zero network');
  }else{
    assert.equal(find(reference).name,'自分で付けた資料名');assert.equal(find('https://example.com/web-title').name,'日本語のWebページ');assert.equal(find('https://tenant.sharepoint.com/:w:/s/lab/RETRY?e=Keep').name,'再試行用.docx');
    await ui(`click('資料目録');await wait(()=>document.querySelector('[aria-label="資料を検索"]'));await input('[aria-label="資料を検索"]','日本語のWebページ');await wait(()=>document.querySelector('[data-document-id]'));if(!document.querySelector('[data-document-id]').textContent.includes('日本語のWebページ'))throw Error('Clipboard name not searchable after restart');`);
    console.log('CLIPBOARD_RESTART_OK');
  }
}
