import type {DocumentBatch} from '../src/shared/documents';
import { app, dialog, nativeTheme, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import type { WorkspaceService } from '../src/main/service';
import { DocumentRepository } from '../src/main/documents';
import {DocumentDraftJournal} from '../src/main/document-drafts';

export async function runPhase3(window: BrowserWindow, service: WorkspaceService, root: string, stage: string, ui: (code: string) => Promise<unknown>) {
  const docs = new DocumentRepository(service.database), original = join(root, 'manual.txt');
  async function image(name: string) { window.show(); window.focus(); nativeTheme.themeSource = name.includes('dark') ? 'dark' : 'light'; await new Promise(resolve => setTimeout(resolve, 180)); await ui(`await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));`); writeFileSync(join(root, name), (await window.webContents.capturePage()).toPNG()); }
  async function dragDocument(source: string, target: string) {
    window.show(); window.focus();
    const points = await ui(`const source=document.querySelector('[data-document-id="${source}"] .document-drag-handle');const target=document.querySelector('[data-document-id="${target}"]'); source.scrollIntoView({block:'center'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();return {x:a.left+a.width/2,y:a.top+a.height/2,tx:b.left+120,ty:b.top+4};`) as { x:number;y:number;tx:number;ty:number };
    const debuggerApi=window.webContents.debugger; debuggerApi.attach('1.3');
    let intercepted: unknown;
    const listener=(_event:Electron.Event,method:string,params: { data?:unknown })=>{if(method==='Input.dragIntercepted')intercepted=params.data;};
    debuggerApi.on('message',listener);
    try {
      await debuggerApi.sendCommand('Input.setInterceptDrags',{enabled:true});
      await debuggerApi.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:points.x,y:points.y});
      await debuggerApi.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',x:points.x,y:points.y,button:'left',buttons:1,clickCount:1});
      for(let step=1;step<=5;step++) await debuggerApi.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:points.x+(points.tx-points.x)*step/5,y:points.y+(points.ty-points.y)*step/5,button:'left',buttons:1});
      const start=Date.now();while(!intercepted){if(Date.now()-start>3000)throw Error('Mouse drag not intercepted');await new Promise(resolve=>setTimeout(resolve,20));}
      for(const type of ['dragEnter','dragOver','drop']) await debuggerApi.sendCommand('Input.dispatchDragEvent',{type,x:points.tx,y:points.ty,data:intercepted});
      await debuggerApi.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x:points.tx,y:points.ty,button:'left',buttons:0,clickCount:1});
    } finally { debuggerApi.off('message',listener);debuggerApi.detach(); }
  }
  if (stage === 'phase3-create') {
    const theme = service.database.commit({ ref: { kind: 'new-theme', id: randomUUID() }, token: randomUUID(), baseRevision: 0, fields: { name: '資料テストテーマ' } }).theme!;
    const create = (title: string) => service.database.commit({ ref: { kind: 'new-item', id: randomUUID() }, token: randomUUID(), baseRevision: 0, fields: { title, themeId: theme.id, originId: null } }).item!;
    const a = create('温度特性の実験'), b = create('装置の準備'); writeFileSync(original, '原本の内容は変更しない');
    await new Promise<void>(resolve => { window.webContents.once('did-finish-load', () => resolve()); window.reload(); });
    await ui(`await wait(() => (document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text'))); click('資料目録'); await wait(() => document.querySelector('h1')?.textContent==='資料目録'); click('資料を追加'); await wait(() => document.querySelector('#document-references')); await input('#document-references',${JSON.stringify(`${original}\nhttps://example.com/Manual\njavascript:invalid`)}); click('登録する'); await wait(() => !document.querySelector('dialog')); await wait(() => document.querySelectorAll('[data-document-id]').length===2); if(!document.body.textContent.includes('1件を登録できませんでした')) throw Error('Missing partial failure'); await input('[aria-label="再試行する参照先1"]','https://example.com/manual'); click('失敗した資料だけ再試行'); await wait(() => document.querySelectorAll('[data-document-id]').length===3);`);
    assert.equal(docs.snapshot().documents.length, 3);
    const dropped = join(root, 'dropped.txt'); writeFileSync(dropped, 'drop original');
    const point = await ui(`const bounds=document.querySelector('.document-panel').getBoundingClientRect(); return {x:bounds.left+50,y:bounds.top+50};`) as { x: number; y: number };
    window.webContents.debugger.attach('1.3');
    for (const type of ['dragEnter', 'dragOver', 'drop']) await window.webContents.debugger.sendCommand('Input.dispatchDragEvent', { type, ...point, data: { items: [], files: [original, dropped], dragOperationsMask: 1 } });
    window.webContents.debugger.detach();
    await ui(`await wait(()=>document.querySelectorAll('[data-document-id]').length===4); const row=[...document.querySelectorAll('[data-document-id]')].find(row=>row.textContent.includes('dropped.txt')); row.querySelector('summary').click(); await new Promise(resolve=>setTimeout(resolve,30)); click('資料の登録解除'); await wait(()=>document.querySelector('dialog')); click('登録解除'); await wait(()=>!document.querySelector('dialog')); await wait(()=>document.querySelectorAll('[data-document-id]').length===3);`);
    assert.equal(readFileSync(dropped,'utf8'),'drop original');
    await ui(`click('HOME'); await wait(() => document.querySelector('h1')?.textContent==='HOME'); click('温度特性の実験'); await wait(() => document.querySelector('.item-title')); click('資料を追加'); await wait(() => document.querySelector('#document-references')); if(document.querySelector('[aria-label="追加する資料の関連テーマ"]').value!==${JSON.stringify(theme.id)})throw Error('Missing theme default'); if(document.querySelectorAll('[data-picker-document]').length)throw Error('Unrelated documents shown by default'); click('条件を解除'); await wait(() => document.querySelector('[data-picker-document]')); document.querySelector('[data-picker-document="${docs.snapshot().documents.find(doc => doc.reference === original)!.id}"] button').click(); await wait(()=>document.querySelector('[data-picker-document="${docs.snapshot().documents.find(doc => doc.reference === original)!.id}"] button').getAttribute('aria-label').endsWith('解除'));click('閉じる');await wait(()=>!document.querySelector('dialog')); await wait(() => document.querySelector('.context-documents [data-document-id]'));  if(document.querySelector('dialog')) throw Error('Memo should edit inline'); await input('.context-documents .inline-document-memo textarea','校正の前に読む'); await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text'))); if(document.querySelector('.context-documents tbody th')) throw Error('Group heading remains');`);
    const id = docs.snapshot().documents.find(doc => doc.reference === original)!.id;
    // Legacy group values remain stored, but must not affect headings or movement.
    const legacyUse = docs.snapshot().uses.find(use => use.documentId === id && use.contextId === a.id)!;
    await docs.request({ action:'use', id, context:{kind:'item',id:a.id}, revision:legacyUse.revision, memo:legacyUse.memo, group:'旧グループ', position:legacyUse.position });
    const extra = docs.snapshot().documents.find(doc => doc.reference === 'https://example.com/Manual')!.id;
    await ui(`click('資料を追加'); await wait(()=>document.querySelector('#document-references')); click('条件を解除'); await wait(()=>document.querySelector('[data-picker-document="${extra}"]')); document.querySelector('[data-picker-document="${extra}"] button').click(); await wait(()=>document.querySelector('[data-picker-document="${extra}"] button').getAttribute('aria-label').endsWith('解除'));click('閉じる');await wait(()=>!document.querySelector('dialog')); await input('[data-document-id="${extra}"] .inline-document-memo textarea','測定前に使う'); await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
    service.database.db.exec('PRAGMA query_only=ON');
    await dragDocument(extra,id);
    await ui(`await wait(()=>document.querySelector('.context-documents [role=alert]')); if(document.querySelector('.context-documents [data-document-id]').getAttribute('data-document-id')!==${JSON.stringify(id)}) throw Error('Failed drag changed order');`);
    service.database.db.exec('PRAGMA query_only=OFF');
    await dragDocument(extra,id);
    await ui(`await wait(()=>document.querySelector('.context-documents [data-document-id]')?.getAttribute('data-document-id')===${JSON.stringify(extra)}); if(document.querySelector('.document-menu')?.textContent.includes('上へ移動')) throw Error('Old move menu remains');`);
    await docs.request({ action: 'attach', id, context: { kind: 'item', id: b.id } });
    assert.equal(docs.snapshot().uses.find(use => use.documentId === id && use.contextId === a.id)!.group, '旧グループ');
    await ui(`if(document.querySelector('.context-documents tbody th')) throw Error('Legacy group heading remains');`);
    assert.equal(docs.snapshot().uses.find(use => use.contextId === b.id)!.memo, '');
    await image('phase3-item-light.png');
    await ui(`click('資料目録'); await wait(() => document.querySelector('h1')?.textContent==='資料目録'); await input('[aria-label="資料を検索"]','校正'); await wait(() => document.querySelectorAll('[data-document-id]').length===1); document.querySelector('.document-menu summary').click(); await new Promise(resolve => setTimeout(resolve,30)); click('資料の詳細'); await wait(() => document.querySelector('dialog input')); await input('dialog input','装置マニュアル'); click('閉じる'); await wait(() => !document.querySelector('dialog'));`);
    assert.equal(docs.get(id).name, '装置マニュアル'); assert.equal(readFileSync(original, 'utf8'), '原本の内容は変更しない');
    await ui(`click('温度特性の実験'); await wait(() => document.querySelector('.item-title')); if(!document.querySelector('.context-documents').textContent.includes('装置マニュアル')) throw Error('Common name not reflected'); document.querySelector('[aria-label="戻る"]').click(); await wait(() => document.querySelector('h1')?.textContent==='資料目録'); if(document.querySelector('[aria-label="資料を検索"]').value!=='校正') throw Error('Catalog query lost'); click('条件を解除'); await input('[aria-label="資料の関連テーマ"]','none'); await wait(() => document.querySelectorAll('[data-document-id]').length===1); await input('[aria-label="資料の種類"]','url'); if(document.querySelectorAll('[data-document-id]').length!==1) throw Error('Kind filter failed'); click('条件を解除');`);
    const sorted = await ui(`await input('[aria-label="資料の並べ替え"]','updated-desc'); return [...document.querySelectorAll('[data-document-id]')].map(row=>row.getAttribute('data-document-id'));`);
    assert.deepEqual(sorted, [...docs.snapshot().documents].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).map(doc => doc.id));
    await ui(`await input('[aria-label="資料の関連テーマ"]',${JSON.stringify(theme.id)}); await wait(()=>document.querySelectorAll('[data-document-id]').length===2); await input('[aria-label="資料の関連テーマ"]','all'); await wait(()=>document.querySelectorAll('[data-document-id]').length===3);`);
    const missing = join(root, 'missing.txt');
    await ui(`click('資料を追加'); await wait(() => document.querySelector('#document-references')); await input('#document-references',${JSON.stringify(missing)}); click('登録する'); await wait(() => !document.querySelector('dialog')); click('missing.txt'); await wait(()=>document.querySelector('.document-error')); if(document.querySelector('dialog')) throw Error('Title opened detail instead of original'); [...document.querySelectorAll('[data-document-id]')].find(row=>row.textContent.includes('missing.txt')).cells[1].click(); await wait(() => document.querySelector('dialog')); click('原本を開く'); await wait(()=>document.querySelector('dialog [role=alert]')); if(!document.querySelector('dialog [role=alert]')?.textContent.includes('missing.txt')) throw Error('Missing reference not shown'); await input('dialog input:nth-of-type(1)', '修正した資料'); const inputs=document.querySelectorAll('dialog input'); const field=inputs[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(join(root, 'corrected.txt'))}); field.dispatchEvent(new InputEvent('input',{bubbles:true})); await new Promise(resolve=>setTimeout(resolve,0)); click('閉じる'); await wait(() => !document.querySelector('dialog'));`);
    assert.equal(docs.snapshot().documents.find(doc => doc.name === '修正した資料')!.reference, join(root, 'corrected.txt'));
    const missingError = await shell.openPath(missing); assert.ok(missingError);
    const openingError = await shell.openPath(original); assert.equal(openingError, '');
    await ui(`const registration=await window.workspace.documents({action:'register',entries:[{reference:'\\\\\\\\unavailable.invalid\\\\share\\\\manual.pdf',kind:'file'}],context:null}); if(!registration.ok) throw Error('Offline registration failed'); const offlineId=registration.value.registered[0]; const start=performance.now(); const opening=window.workspace.documents({action:'open',id:offlineId}); const local=await window.workspace.getWorkspace(); if(!local.ok || performance.now()-start>1500) throw Error('Network open blocked local workspace'); const result=await opening; if(result.ok || !result.error.message.includes('unavailable.invalid')) throw Error('Offline error missing'); const all=await window.workspace.documents({action:'list'}); const doc=all.value.documents.find(doc=>doc.id===offlineId); await window.workspace.documents({action:'remove',id:offlineId,revision:doc.revision,linkCount:0});`);
    await ui(`click('資料テストテーマ'); await wait(() => document.querySelector('[aria-label="テーマ名"]')); await wait(() => document.querySelectorAll('.context-documents [data-document-id]').length===2); if(!document.querySelector('.context-documents').textContent.includes('装置の準備')) throw Error('Theme aggregate missing source');`);
    await image('phase3-theme-light.png');
    await ui(`if(document.querySelector('.context-documents .document-reference')) throw Error('Redundant context path remains'); const row=document.querySelector('[data-document-id="${id}"]'); if(row.querySelector('.document-name').title!==${JSON.stringify(original)}) throw Error('Reference hover lost'); const links=row.querySelectorAll('[data-related-page]'); if(links.length!==2 || Math.abs(links[0].getBoundingClientRect().top-links[1].getBoundingClientRect().top)>2) throw Error('Related pages not horizontal');`);
    await ui(`const row=document.querySelector('[data-document-id="${id}"]'); if(row.querySelector('.inline-document-memo')) throw Error('Aggregate memo shown'); const strip=row.querySelector('.related-name-strip'); strip.style.maxWidth='90px'; await wait(()=>row.querySelector('.related-overflow')); if(getComputedStyle(strip).overflowX!=='hidden') throw Error('Related names scroll'); row.click(); await wait(()=>document.querySelector('.document-detail-dialog')); if(document.querySelectorAll('.document-detail-relations .page-relation').length!==2) throw Error('Missing detail relations');`);
    service.database.db.exec('PRAGMA query_only=ON');
    await ui(`await input('#use-${id}-item-${a.id}-detail','校正の前に読む（追記）'); await input('#use-${id}-item-${b.id}-detail','別の実験で使う'); await wait(()=>document.querySelectorAll('.inline-memo-error').length===2); if(document.querySelector('#use-${id}-item-${a.id}-detail').value!=='校正の前に読む（追記）') throw Error('Inline failure lost input');`);
    service.database.db.exec('PRAGMA query_only=OFF');
    await ui(`click('閉じる'); await wait(()=>!document.querySelector('dialog')); await wait(()=>!document.querySelector('.inline-memo-error')); await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
    assert.equal(docs.snapshot().uses.find(use => use.documentId === id && use.contextId === a.id)!.memo,'校正の前に読む（追記）');
    assert.equal(docs.snapshot().uses.find(use => use.documentId === id && use.contextId === b.id)!.memo,'別の実験で使う');
    await ui(`document.querySelector('[data-document-id="${id}"]').click(); await wait(()=>document.querySelector('.document-detail-dialog'));`);
    await image('document-detail-light.png');
    await ui(`const buttons=[...document.querySelectorAll('.document-detail-relations .page-relation button')]; buttons.find(button=>button.textContent.includes('装置の準備')).click(); await wait(()=>!document.querySelector('dialog')); await wait(()=>document.querySelector('.item-title')?.value==='装置の準備');`);

    console.log('PHASE3_THEME_VERIFIED');
    // Many actual persisted references exercise scroll restoration and small-window layout.
    await docs.request({ action: 'register', entries: Array.from({ length: 30 }, (_, i) => ({ reference: `https://example.com/reference/${i}` })), context: null });
    await new Promise<void>(resolve => { window.webContents.once('did-finish-load', () => resolve()); window.reload(); });
    await ui(`await wait(() => (document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text'))); click('資料目録'); await wait(() => document.querySelectorAll('[data-document-id]').length===34); await input('[aria-label="資料の並べ替え"]','name-desc'); document.querySelector('.document-table-scroll').scrollTop=200; document.querySelector('.document-table-scroll').dispatchEvent(new Event('scroll',{bubbles:true})); click('温度特性の実験'); await wait(()=>document.querySelector('.item-title')); document.querySelector('[aria-label="戻る"]').click(); await wait(()=>document.querySelector('h1')?.textContent==='資料目録'); if(document.querySelector('.document-table-scroll').scrollTop<190) throw Error('Catalog scroll lost'); if(!document.querySelector('.document-table [data-return-anchor=true]')) throw Error('Catalog selection lost');`);
    console.log('PHASE3_CATALOG_VERIFIED');
    await ui(`const row=document.querySelector('.document-table [data-return-anchor=true]'); if(!row) throw Error('Catalog return anchor lost'); if(document.querySelector('[aria-selected=true],.selected-someday,.selected-document')) throw Error('Unexpected selection highlight'); for(const cell of row.querySelectorAll('td')) if(getComputedStyle(cell).backgroundColor!=='rgba(0, 0, 0, 0)') throw Error('Catalog anchor highlighted');`);
    await image('phase3-catalog-light.png'); await image('phase3-catalog-dark.png');
    window.setSize(1100, 700); await image('phase3-catalog-1100.png');
    window.webContents.setZoomFactor(1.25); await image('phase3-catalog-125.png'); window.webContents.setZoomFactor(1); window.setSize(1366,768);
    await ui(`click('HOME'); await wait(()=>document.querySelector('h1')?.textContent==='HOME'); click('温度特性の実験'); await wait(()=>document.querySelector('.item-title')); click('資料を追加'); await wait(()=>document.querySelector('[aria-label="追加する資料の関連テーマ"]')); if(document.querySelector('[aria-label="追加する資料の関連テーマ"]').value!==${JSON.stringify(theme.id)})throw Error('Theme default lost'); click('条件を解除'); await wait(()=>document.querySelectorAll('[data-picker-document]').length===34); if(document.querySelector('[aria-label="関連付ける資料"]') || document.querySelector('.document-tabs')) throw Error('Old tab/dropdown still present'); if(!document.querySelector('#document-references')) throw Error('New registration not visible'); await input('[aria-label="追加する資料を検索"]','校正'); await wait(()=>document.querySelectorAll('[data-picker-document]').length===1); if(document.querySelector('[data-picker-document] button').disabled||!document.querySelector('[data-picker-document] button').getAttribute('aria-label').endsWith('解除')) throw Error('Detach action missing'); await input('[aria-label="追加する資料を検索"]',''); await input('[aria-label="追加する資料の種類"]','file'); await wait(()=>document.querySelectorAll('[data-picker-document]').length===2); await input('[aria-label="追加する資料の関連テーマ"]',${JSON.stringify(theme.id)}); await wait(()=>document.querySelectorAll('[data-picker-document]').length===1); await input('[aria-label="追加する資料の関連テーマ"]','none'); await wait(()=>document.querySelectorAll('[data-picker-document]').length===1); await input('[aria-label="追加する資料を検索"]','見つからない資料'); await wait(()=>document.querySelectorAll('[data-picker-document]').length===0); click('条件を解除'); await wait(()=>document.querySelectorAll('[data-picker-document]').length===34);`);
    await image('document-picker-light.png'); window.setSize(1100,700); window.webContents.setZoomFactor(1.25); await image('document-picker-125.png'); window.webContents.setZoomFactor(1); window.setSize(1366,768);
    const pickerTarget = docs.snapshot().documents.find(doc => doc.reference === 'https://example.com/reference/0')!;
    await ui(`await input('[aria-label="追加する資料を検索"]','https://example.com/reference/0'); await wait(()=>document.querySelectorAll('[data-picker-document]').length===1);`);
    service.database.db.exec('PRAGMA query_only=ON');
    await ui(`document.querySelector('[data-picker-document] button').click(); await wait(()=>document.querySelector('dialog [role=alert]')); if(document.querySelector('[aria-label="追加する資料を検索"]').value!=='https://example.com/reference/0') throw Error('Picker query lost on failure');`);
    service.database.db.exec('PRAGMA query_only=OFF');
    await ui(`document.querySelector('[data-picker-document] button').click(); await wait(()=>document.querySelector('[data-picker-document] button').getAttribute('aria-label').endsWith('解除'));click('閉じる');await wait(()=>!document.querySelector('dialog'));if(!document.querySelector('.item-title')) throw Error('Picker navigated away');`);
    const temporaryUse = docs.snapshot().uses.find(use => use.documentId === pickerTarget.id && use.contextId === a.id)!;
    await docs.request({ action:'detach', id:pickerTarget.id, context:{kind:'item',id:a.id}, revision:temporaryUse.revision });
    await ui(`click('資料を追加'); await wait(()=>document.querySelector('#document-references')); await input('#document-references',${JSON.stringify(original)}); click('登録する'); await wait(()=>!document.querySelector('dialog')); if(!document.querySelector('.item-title')) throw Error('Registration navigated away');`);
    await ui(`click('HOME'); await wait(()=>document.querySelector('h1')?.textContent==='HOME');`);
    assert.equal(docs.snapshot().uses.filter(use => use.documentId === id).length, 2); assert.equal(service.database.item(a.id).title, '温度特性の実験');
  } else if (stage === 'phase3-restart') {
    assert.equal(docs.snapshot().documents.length, 34); assert.equal(docs.snapshot().uses.length, 3);
    assert.equal(docs.snapshot().view?.sort, 'name-desc'); assert.ok(docs.snapshot().view!.scroll > 0);
    await ui(`click('資料目録'); await wait(()=>document.querySelectorAll('[data-document-id]').length===34); await input('[aria-label="資料を検索"]','校正'); await wait(()=>document.querySelectorAll('[data-document-id]').length===1); document.querySelector('.document-menu summary').click(); await new Promise(resolve => setTimeout(resolve,30)); click('資料の登録解除'); await wait(() => document.querySelector('dialog')); if(!document.querySelector('dialog').textContent.includes('2件の関連付け')) throw Error('Missing unregister link count'); click('登録解除'); await wait(()=>!document.querySelector('dialog')); await wait(()=>document.querySelectorAll('[data-document-id]').length===0);`);
    assert.equal(docs.snapshot().uses.length, 1); assert.equal(readFileSync(original,'utf8'),'原本の内容は変更しない');
  } else if (stage === 'phase3-crash') {
    const id = docs.snapshot().documents.find(doc => doc.reference === 'https://example.com/Manual')!.id;
    await ui(`click('資料目録'); await wait(()=>document.querySelector('[aria-label="資料を検索"]')); click('条件を解除'); await wait(()=>document.querySelector('[data-document-id="${id}"]')); document.querySelector('[data-document-id="${id}"] summary').click(); await new Promise(resolve=>setTimeout(resolve,30)); click('資料の詳細'); await wait(()=>document.querySelector('dialog textarea'));`);
    service.database.db.exec('PRAGMA query_only=ON');
    await ui(`await input('dialog textarea','失敗しても保護する資料メモ'); await wait(()=>document.querySelector('dialog [role=status]')?.textContent.includes('保存できませんでした')); if(document.querySelector('dialog textarea').value!=='失敗しても保護する資料メモ') throw Error('Failed document input lost'); const result=await window.workspace.documents({action:'list'}); if(!result.ok || result.value.drafts.length!==1) throw Error('Document draft not protected');`);
    await image('phase3-save-error.png');
    service.database.db.exec('PRAGMA query_only=OFF');
    await ui(`click('再試行'); await wait(()=>!document.querySelector('dialog [role=status]')); click('閉じる'); await wait(()=>!document.querySelector('dialog'));`);
    assert.equal(docs.get(id).description, '失敗しても保護する資料メモ');
    await ui(`document.querySelector('[data-document-id="${id}"]').click(); await wait(()=>document.querySelector('.document-detail-dialog')); const memo=document.querySelector('.document-detail-relations .inline-document-memo textarea'); await input('#'+memo.id,'インラインから復旧する用途メモ',true);`);
    await ui(`await input('dialog textarea','異常終了から復旧する資料メモ',true);if(document.querySelector('dialog [role=status]'))throw Error('Normal draft status remains');`);
    const journal=new DocumentDraftJournal(join(root,'drafts','documents'));
    for(let attempt=0;attempt<200&&!journal.list().some(draft=>draft.edit.action==='edit'&&draft.edit.description==='異常終了から復旧する資料メモ');attempt++)await new Promise(resolve=>setTimeout(resolve,30));
    assert.ok(journal.list().some(draft=>draft.edit.action==='edit'&&draft.edit.description==='異常終了から復旧する資料メモ'));
    assert.equal(docs.get(id).description, '失敗しても保護する資料メモ');
    console.log('PHASE3_CRASH_DRAFT_PROTECTED'); app.exit(17); return;
  } else if (stage === 'phase3-recover') {
    await ui(`await wait(()=>document.body.textContent.includes('資料の未保存の入力が2件あります')); click('資料目録で復旧'); await wait(()=>document.querySelector('h1')?.textContent==='資料目録'); click('復旧する'); await wait(()=>document.querySelector('dialog textarea')); if(document.querySelector('dialog textarea').value!=='異常終了から復旧する資料メモ') throw Error('Wrong document recovery'); click('閉じる'); await wait(()=>!document.querySelector('dialog')); click('復旧する'); await wait(()=>document.querySelector('dialog textarea')); if(document.querySelector('dialog textarea').value!=='インラインから復旧する用途メモ') throw Error('Wrong inline memo recovery'); click('閉じる'); await wait(()=>!document.querySelector('dialog')); await wait(()=>!document.body.textContent.includes('資料の未保存の入力があります'));`);
    assert.equal(docs.snapshot().uses.find(use => use.documentId === docs.snapshot().documents.find(doc => doc.reference === 'https://example.com/Manual')!.id)!.memo,'インラインから復旧する用途メモ');
    assert.equal(docs.snapshot().documents.find(doc => doc.reference === 'https://example.com/Manual')!.description, '異常終了から復旧する資料メモ');
    await image('phase3-recovered-light.png');
    const id = docs.snapshot().documents.find(doc => doc.reference === 'https://example.com/Manual')!.id;
    await ui(`const reset=[...document.querySelectorAll('button')].find(button=>button.textContent==='条件を解除'); if(reset) reset.click(); await wait(()=>document.querySelector('[data-document-id="${id}"] summary')); document.querySelector('[data-document-id="${id}"] summary').click(); await new Promise(resolve=>setTimeout(resolve,30)); click('資料の詳細'); await wait(()=>document.querySelector('dialog textarea')); await input('dialog textarea','終了直前に保存する資料メモ');`);
  } else if (stage === 'phase3-close-restart') {
    assert.equal(docs.snapshot().documents.find(doc => doc.reference === 'https://example.com/Manual')!.description, '終了直前に保存する資料メモ');
    await ui(`if(document.querySelector('h1')?.textContent!=='HOME') throw Error('Wrong startup route'); const result=await window.workspace.documents({action:'list'}); if(!result.ok || result.value.drafts.length) throw Error('Committed draft was recovered');`);
  } else if (stage === 'phase3-page-ui') {
    const theme=service.database.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'ページ画面テスト'}}).theme!;
    const create=(title:string,themeId:string|null)=>service.database.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title,themeId,originId:null}}).item!;
    const origin=create('関連元のページ',theme.id), target=create('別テーマの候補',null), other=create('同じテーマの候補',theme.id);
    service.database.commit({ref:{kind:'item',id:target.id},token:randomUUID(),baseRevision:target.revision,fields:{title:target.title,state:'完了',themeId:null,summary:'検索できるサマリ',body:'',dueDate:null,reviewDate:null}});
    const original=join(root,'page-ui-original.txt');writeFileSync(original,'UI test original');
    const registration=await docs.request({action:'register',entries:[{reference:original}],context:{kind:'item',id:origin.id}}) as {registered:string[]};
    const docId=registration.registered[0]!;
    await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.reload();});
    await ui(`await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text'))); click('ページ画面テスト'); await wait(()=>document.querySelector('[aria-label="テーマ名"]')); const toggle=[...document.querySelectorAll('label')].find(label=>label.textContent==='完了・中止を含む'); if(!toggle.closest('.list-controls')) throw Error('Closed filter has its own row'); const a=toggle.getBoundingClientRect(),b=document.querySelector('.list-search').getBoundingClientRect(); if(Math.abs(a.top-b.top)>15) throw Error('Closed filter wrapped unnecessarily'); if(getComputedStyle(document.querySelector('.item-table-scroll')).borderTopWidth!=='0px'||getComputedStyle(document.querySelector('.context-documents')).borderTopWidth!=='0px') throw Error('Redundant theme divider'); if(document.body.textContent.includes('検討項目')) throw Error('Old terminology remains');`);
    await image('page-ui-theme.png');
    await ui(`click('関連元のページ'); await wait(()=>document.querySelector('.item-title')); const sections=[...document.querySelector('.item-page').children]; const order=['.properties','.body-section','.context-documents','.related-section'].map(selector=>sections.indexOf(document.querySelector(selector))); if(order.some((value,index)=>index&&value<=order[index-1])) throw Error('Wrong section order'); if(document.querySelector('.body-label')||document.querySelector('.insight-button')||document.body.textContent.includes('気づきを残す')) throw Error('Old heading or insight action remains'); if(document.querySelector('#item-body').getAttribute('aria-label')!=='本文') throw Error('Body lost accessible name'); for(const selector of ['.body-section','.context-documents','.related-section']) if(getComputedStyle(document.querySelector(selector)).borderTopWidth!=='0px') throw Error('Redundant page divider'); const last=document.querySelector('.context-documents tbody tr:last-child td'); if(getComputedStyle(last).borderBottomWidth!=='0px') throw Error('Trailing table line remains'); click('ページを追加'); await wait(()=>document.querySelector('.page-picker-dialog')); if(document.querySelector('[data-picker-page="${origin.id}"]')||document.querySelector('.link-picker')) throw Error('Self link or old dropdown remains'); await input('[aria-label="追加するページを検索"]','検索できるサマリ'); await wait(()=>document.querySelectorAll('[data-picker-page]').length===1); await input('[aria-label="追加するページの状態"]','未着手'); await wait(()=>document.querySelectorAll('[data-picker-page]').length===0); await input('[aria-label="追加するページの状態"]','完了'); await wait(()=>document.querySelectorAll('[data-picker-page]').length===1); await input('[aria-label="追加するページのテーマ"]',${JSON.stringify(theme.id)}); await wait(()=>document.querySelectorAll('[data-picker-page]').length===0); await input('[aria-label="追加するページのテーマ"]','none'); await wait(()=>document.querySelectorAll('[data-picker-page]').length===1);`);
    await image('page-picker-filtered.png');
    service.database.db.exec('PRAGMA query_only=ON');
    await ui(`document.querySelector('[data-picker-page="${target.id}"] button').click(); await wait(()=>document.querySelector('dialog [role=alert]')); if(document.querySelector('[aria-label="追加するページを検索"]').value!=='検索できるサマリ') throw Error('Failed attach cleared query');`);
    service.database.db.exec('PRAGMA query_only=OFF');
    await ui(`document.querySelector('[data-picker-page="${target.id}"] button').click(); await wait(()=>!document.querySelector('dialog')); if(document.querySelector('.item-title').value!=='関連元のページ') throw Error('Attach navigated away'); click('ページを追加'); await wait(()=>document.querySelector('.page-picker-dialog')); if(!document.querySelector('[data-picker-page="${target.id}"] button').disabled) throw Error('Already related not disabled'); await input('[aria-label="追加するページのテーマ"]',${JSON.stringify(theme.id)}); await wait(()=>document.querySelector('[data-picker-page="${other.id}"]')); await input('#related-page-title','新しく関連付けるページ'); const field=document.querySelector('#related-page-title'); field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,keyCode:229,bubbles:true})); await new Promise(resolve=>setTimeout(resolve,80)); if(!document.querySelector('dialog')) throw Error('IME submitted');`);
    assert.ok(!service.database.items().some(item=>item.title==='新しく関連付けるページ'));
    await image('page-picker-create.png');
    window.setSize(1100,700);window.webContents.setZoomFactor(1.25);await image('page-picker-125.png');
    await ui(`const dialog=document.querySelector('.page-picker-dialog'),list=dialog.querySelector('.page-picker-list'); if(dialog.getBoundingClientRect().bottom>innerHeight||dialog.scrollWidth>dialog.clientWidth+1||list.scrollWidth>list.clientWidth+1) throw Error('Page picker overflow');`);
    window.webContents.setZoomFactor(1);window.setSize(1366,768);
    service.database.db.exec('PRAGMA query_only=ON');
    await ui(`click('作成して追加'); await wait(()=>document.querySelector('dialog [role=alert]')); if(document.querySelector('#related-page-title').value!=='新しく関連付けるページ') throw Error('Failed create lost title');`);
    service.database.db.exec('PRAGMA query_only=OFF');
    await ui(`click('作成して追加'); await wait(()=>!document.querySelector('dialog')); if(document.querySelector('.item-title').value!=='関連元のページ') throw Error('Creation navigated away');`);
    const created=service.database.items().find(item=>item.title==='新しく関連付けるページ')!;
    assert.equal(created.state,'未着手');assert.equal(created.themeId,theme.id);
    assert.ok(service.database.links().some(link=>link.sourceId===origin.id&&link.targetId===created.id&&link.kind==='related'));
    await ui(`click('新しく関連付けるページ'); await wait(()=>document.querySelector('.item-title')?.value==='新しく関連付けるページ'); if(!document.querySelector('.related-section').textContent.includes('関連元のページ')) throw Error('Reverse relation missing'); click('関連元のページ'); await wait(()=>document.querySelector('.item-title')?.value==='関連元のページ');`);
    const openPath=shell.openPath, opened:string[]=[];
    shell.openPath=async path=>{opened.push(path);return '';};
    try {
      await ui(`document.querySelector('[data-document-id="${docId}"] .document-name').click(); await new Promise(resolve=>setTimeout(resolve,100)); if(document.querySelector('dialog')) throw Error('Title opened detail');`);
      assert.deepEqual(opened,[original]);
      await ui(`document.querySelector('[data-document-id="${docId}"] td:nth-child(2)').click(); await wait(()=>document.querySelector('.document-detail-dialog')); click('閉じる'); await wait(()=>!document.querySelector('dialog'));`);
      assert.equal(opened.length,1);
    } finally {shell.openPath=openPath;}
    await image('page-ui-detail.png');
    await ui(`click('資料を追加');await wait(()=>document.querySelector('[aria-label="追加する資料の関連テーマ"]'));if(document.querySelector('[aria-label="追加する資料の関連テーマ"]').value!==${JSON.stringify(theme.id)})throw Error('Page theme not selected by default');await wait(()=>document.querySelectorAll('[data-picker-document]').length===1);if(!document.querySelector('[data-picker-document="${docId}"]'))throw Error('Theme filter shows unrelated documents');click('条件を解除');await wait(()=>document.querySelectorAll('[data-picker-document]').length>1);click('閉じる');await wait(()=>!document.querySelector('dialog'));click('資料を追加');await wait(()=>document.querySelector('[aria-label="追加する資料の関連テーマ"]'));if(document.querySelector('[aria-label="追加する資料の関連テーマ"]').value!==${JSON.stringify(theme.id)})throw Error('Reopen lost theme default');click('閉じる');await wait(()=>!document.querySelector('dialog'));await input('#item-theme','');click('資料を追加');await wait(()=>document.querySelector('[aria-label="追加する資料の関連テーマ"]'));if(document.querySelector('[aria-label="追加する資料の関連テーマ"]').value!=='all')throw Error('Unassigned page has a theme filter');await wait(()=>document.querySelectorAll('[data-picker-document]').length>1);click('閉じる');await wait(()=>!document.querySelector('dialog'));await input('#item-theme',${JSON.stringify(theme.id)});await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
    await ui(`click('HOME'); await wait(()=>document.querySelector('h1')?.textContent==='HOME'); if(getComputedStyle(document.querySelector('.item-table-scroll')).borderTopWidth!=='0px') throw Error('HOME filter divider remains');`);
    console.log('PAGE_UI_PICKER_AND_DOCUMENT_OPEN_OK');
  } else if (stage === 'phase3-save-isolation') {
    const context={kind:'item' as const,id:service.database.items()[0]!.id};
    const registered=await docs.request({action:'register',entries:[{reference:'https://example.com/save-a'},{reference:'https://example.com/save-b'}],context}) as {registered:string[]};
    const [a,b]=registered.registered as [string,string];
    await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.reload();});
    await ui(`await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text'))); click('資料目録'); await wait(()=>document.querySelector('[data-document-id="${a}"]')); document.querySelector('[data-document-id="${a}"]').click(); await wait(()=>document.querySelector('.document-detail-dialog')); if([...document.querySelectorAll('dialog button')].some(button=>button.textContent==='保存する')) throw Error('Duplicate save action');`);
    service.database.db.exec(`CREATE TEMP TRIGGER fail_document_a BEFORE UPDATE ON documents WHEN OLD.id='${a}' BEGIN SELECT RAISE(ABORT,'test document failure'); END;
      CREATE TEMP TRIGGER fail_memo_a BEFORE UPDATE ON document_uses WHEN OLD.documentId='${a}' BEGIN SELECT RAISE(ABORT,'test memo failure'); END;`);
    await ui(`await input('[aria-label="資料のタイトル"]','保持する資料A'); await input('dialog .inline-document-memo textarea','保持する用途A'); await wait(()=>document.querySelector('dialog [role=status]')?.classList.contains('error-text')); if(!document.querySelector('.save-status.error-text')) throw Error('Global error status missing'); click('閉じる'); await wait(()=>!document.querySelector('dialog')); document.querySelector('[data-document-id="${b}"]').click(); await wait(()=>document.querySelector('.document-detail-dialog')); if(document.querySelector('dialog [role=status]')) throw Error('Unrelated error leaked into detail'); await input('[aria-label="資料のタイトル"]','独立して保存する資料B'); await input('dialog .inline-document-memo textarea','独立して保存する用途B'); click('閉じる'); await wait(()=>!document.querySelector('dialog'));`);
    assert.equal(docs.get(b).name,'独立して保存する資料B');
    assert.equal(docs.snapshot().uses.find(use=>use.documentId===b)!.memo,'独立して保存する用途B');
    assert.notEqual(docs.get(a).name,'保持する資料A');
    await ui(`document.querySelector('[data-document-id="${a}"]').click(); await wait(()=>document.querySelector('.document-detail-dialog')); if(document.querySelector('[aria-label="資料のタイトル"]').value!=='保持する資料A'||document.querySelector('dialog .inline-document-memo textarea').value!=='保持する用途A') throw Error('Failed draft lost after switching documents');`);
    service.database.db.exec('DROP TRIGGER fail_document_a; DROP TRIGGER fail_memo_a;');
    await ui(`document.querySelector('dialog .modal-footer .outline-button').click(); await wait(()=>!document.querySelector('dialog [role=status]')); if(!document.querySelector('dialog')) throw Error('Retry unexpectedly closed detail'); click('閉じる'); await wait(()=>!document.querySelector('dialog')); await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
    assert.equal(docs.get(a).name,'保持する資料A');
    assert.equal(docs.snapshot().uses.find(use=>use.documentId===a)!.memo,'保持する用途A');
    service.database.db.exec('PRAGMA query_only=ON');
    await ui(`await input('[aria-label="資料を検索"]','表示設定の障害'); await wait(()=>document.querySelector('.save-status')?.textContent==='表示設定の保存に失敗しました'); if(!document.querySelector('.save-status.error-text svg')) throw Error('Error icon missing'); click('HOME'); await wait(()=>document.querySelector('h1')?.textContent==='HOME'); if(!document.body.textContent.includes('資料一覧の表示設定を再試行')) throw Error('View retry lost on navigation');`);
    service.database.db.exec('PRAGMA query_only=OFF');
    await ui(`click('資料一覧の表示設定を再試行'); await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text'))); click('資料目録'); await wait(()=>document.querySelector('[aria-label="資料を検索"]')); click('条件を解除'); await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
    // Stub only the native dialog selection; exercise the real close IPC and flush boundary.
    const showMessageBox=dialog.showMessageBox;
    const prompts:Electron.MessageBoxOptions[]=[];
    dialog.showMessageBox=(async (...args:unknown[])=>{prompts.push(args.at(-1) as Electron.MessageBoxOptions);return {response:0,checkboxChecked:false};}) as typeof dialog.showMessageBox;
    const closePrompt=async()=>{const count=prompts.length;window.close();const started=Date.now();while(prompts.length===count){if(Date.now()-started>6000)throw Error('Close prompt timed out');await new Promise(resolve=>setTimeout(resolve,20));}await new Promise(resolve=>setTimeout(resolve,20));return prompts.at(-1)!;};
    try {
      await ui(`document.querySelector('[data-document-id="${a}"]').click(); await wait(()=>document.querySelector('.document-detail-dialog'));`);
      service.database.db.exec('PRAGMA query_only=ON');
      await ui(`await input('[aria-label="資料のタイトル"]','終了失敗でも残す資料A'); await wait(()=>document.querySelector('dialog [role=status]')?.classList.contains('error-text')); click('閉じる'); await wait(()=>!document.querySelector('dialog')); click('資料を追加'); await wait(()=>document.querySelector('#document-references')); await input('#document-references','https://example.com/unregistered');`);
      const failed=await closePrompt();
      assert.equal(failed.title,'保存を完了できませんでした');
      assert.ok(!failed.buttons!.includes('下書きを残して終了'),'Raw registration must not be bypassed');
      service.database.db.exec('PRAGMA query_only=OFF');
      const registration=await closePrompt();
      assert.equal(registration.title,'登録前の入力があります');
      assert.equal(docs.get(a).name,'終了失敗でも残す資料A');
      await ui(`if(document.querySelector('#document-references').value!=='https://example.com/unregistered') throw Error('Native cancel lost raw input'); await input('#document-references','javascript:invalid'); click('登録する'); await wait(()=>!document.querySelector('dialog')); await wait(()=>document.querySelector('.document-failures'));`);
      assert.equal((await closePrompt()).title,'登録前の入力があります');
      await ui(`await input('[aria-label="再試行する参照先1"]',''); click('資料を追加'); await wait(()=>document.querySelector('#document-references'));`);
    } finally { service.database.db.exec('PRAGMA query_only=OFF');dialog.showMessageBox=showMessageBox; }
    // The harness closes the actual window while this empty add dialog stays open.
    console.log('SAVE_ISOLATION_AND_CLOSE_REASONS_OK');
  } else if (stage === 'phase3-density') {
    const theme=service.database.themes()[0]!;
    const result=await docs.request({action:'register',entries:[{reference:'https://example.com/density-manual'}],context:null}) as {registered:string[]};
    const docId=result.registered[0]!;
    for(let index=1;index<=20;index++) {
      const item=service.database.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title:`測定条件の確認 ${index}`,themeId:theme.id,originId:null}}).item!;
      await docs.request({action:'attach',id:docId,context:{kind:'item',id:item.id}});
      const use=docs.snapshot().uses.find(use=>use.documentId===docId&&use.contextId===item.id)!;
      await docs.request({action:'use',id:docId,context:{kind:'item',id:item.id},revision:use.revision,memo:`条件 ${index} の確認に使う`,group:'',position:use.position});
    }
    await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.reload();});
    await ui(`await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text'))); click('資料目録'); await wait(()=>document.querySelector('[data-document-id="${docId}"]')); document.querySelector('[data-document-id="${docId}"]').click(); await wait(()=>document.querySelector('.document-detail-dialog'));`);
    await image('document-detail-dense-many.png');
    const check=async()=>await ui(`const dialog=document.querySelector('.document-detail-dialog'),list=dialog.querySelector('.document-detail-relations'); const bounds=list.getBoundingClientRect(); const rows=[...list.querySelectorAll('.page-relation')];const visible=rows.filter(row=>{const r=row.getBoundingClientRect();return r.top>=bounds.top&&r.bottom<=bounds.bottom;}).length; if(dialog.getBoundingClientRect().bottom>innerHeight) throw Error('Dialog overflow'); if(list.scrollHeight<=list.clientHeight) throw Error('Missing internal scroll'); if(list.scrollWidth>list.clientWidth+1) throw Error('Horizontal overflow'); if(parseFloat(getComputedStyle(rows[0].querySelector('button')).fontSize)<12) throw Error('Text too small');return {visible,rowHeight:rows[0].getBoundingClientRect().height};`) as {visible:number;rowHeight:number};
    const normal=await check(); assert.ok(normal.visible>=10,JSON.stringify(normal)); assert.ok(normal.rowHeight<=35,JSON.stringify(normal));
    window.setSize(1100,700);window.webContents.setZoomFactor(1.25);await image('document-detail-dense-many-125.png');
    const compact=await check();assert.ok(compact.visible>=4,JSON.stringify(compact));
    window.webContents.setZoomFactor(1);window.setSize(1366,768);
    await ui(`document.querySelector('.document-detail-relations').scrollTop=99999; document.querySelector('.document-detail-relations').dispatchEvent(new Event('scroll'));`);
    await image('document-detail-dense-last.png');
    await ui(`const last=document.querySelectorAll('.document-detail-relations .page-relation'); const row=last[last.length-1]; const memo=row.querySelector('textarea'); memo.focus(); await input('#'+memo.id,'末尾の用途も直接編集'); click('閉じる'); await wait(()=>!document.querySelector('dialog'));`);
    assert.ok(docs.snapshot().uses.some(use=>use.documentId===docId&&use.memo==='末尾の用途も直接編集'));
    console.log(`DETAIL_DENSITY_OK ${JSON.stringify({normal,compact})}`);
    const orderTheme=service.database.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'集約資料の並べ替え確認'}}).theme!;
    const orderPage=service.database.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title:'並べ替え元ページ',themeId:orderTheme.id,originId:null}}).item!;
    const directContext={kind:'theme' as const,id:orderTheme.id},pageContext={kind:'item' as const,id:orderPage.id};
    const directBatch=await docs.request({action:'register',entries:[{reference:'https://example.com/theme-order-direct',name:'直接資料'}],context:directContext}) as DocumentBatch;
    const pageBatch=await docs.request({action:'register',entries:[{reference:'https://example.com/theme-order-page1',name:'ページ資料1'},{reference:'https://example.com/theme-order-page2',name:'ページ資料2'}],context:pageContext}) as DocumentBatch;
    const directId=directBatch.registered[0]!,[pageId1,pageId2]=pageBatch.registered;
    const initialIds=[directId,pageId1!,pageId2!];
    await docs.request({action:'reorder',context:directContext,ids:initialIds,revisions:initialIds.map(id=>docs.snapshot().uses.find(use=>use.documentId===id)!.revision)});
    const usesBefore=JSON.stringify(docs.snapshot().uses);
    await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.reload();});
    await ui(`await wait(()=>document.querySelector('.workspace[aria-busy="false"]'));click('集約資料の並べ替え確認');await wait(()=>document.querySelectorAll('.document-drag-handle').length===3);`);
    await dragDocument(pageId2!,directId);
    await ui(`await wait(()=>document.querySelector('.context-documents tbody tr')?.dataset.documentId==='${pageId2}');`);
    await dragDocument(directId,pageId2!);
    await ui(`await wait(()=>document.querySelector('.context-documents tbody tr')?.dataset.documentId==='${directId}');`);
    await dragDocument(pageId1!,directId);
    await ui(`await wait(()=>document.querySelector('.context-documents tbody tr')?.dataset.documentId==='${pageId1}');`);
    assert.equal(JSON.stringify(docs.snapshot().uses),usesBefore);
    const savedOrder=docs.snapshot().themeOrders![orderTheme.id];
    await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.reload();});
    await ui(`await wait(()=>document.querySelector('.workspace[aria-busy="false"]'));click('集約資料の並べ替え確認');await wait(()=>document.querySelectorAll('.document-drag-handle').length===3);if(JSON.stringify([...document.querySelectorAll('.context-documents tbody tr')].map(row=>row.dataset.documentId))!==${JSON.stringify(JSON.stringify(savedOrder))})throw Error('Theme order not restored');`);
    await image('theme-aggregate-order.png');console.log('THEME_AGGREGATE_DRAG_OK');
  }
  console.log(`PHASE3_OK ${stage}`);
}



