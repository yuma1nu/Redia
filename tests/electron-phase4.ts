import {app,dialog,Menu,nativeImage,nativeTheme,shell} from 'electron';
import type {BrowserWindow} from 'electron';
import {readFileSync,writeFileSync,renameSync,unlinkSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import type {WorkspaceService} from '../src/main/service';
import {DocumentRepository} from '../src/main/documents';
import {bodyText,parseBody} from '../src/shared/body';
export async function runPhase4(window:BrowserWindow,service:WorkspaceService,root:string,stage:string,ui:(code:string)=>Promise<unknown>){
  window.webContents.on('console-message',(_event,...details)=>console.log('PHASE4_RENDERER',JSON.stringify(details).slice(0,1800)));
  const db=service.database,find=(title:string)=>db.items().find(item=>item.title===title)!;
  const wait=async(predicate:()=>boolean)=>{const start=Date.now();while(!predicate()){if(Date.now()-start>6000)throw Error('Phase4 main wait timed out');await new Promise(resolve=>setTimeout(resolve,30));}};
  const screenshot=async(name:string)=>{window.show();window.focus();nativeTheme.themeSource=name.includes('dark')?'dark':'light';await ui(`await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));`);writeFileSync(join(root,name),(await window.webContents.capturePage()).toPNG());};
  const key=async(keyCode:string,modifiers:('control'|'shift')[]=[])=>{window.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});window.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await new Promise(resolve=>setTimeout(resolve,30));};
  const type=async(text:string)=>{for(const ch of text){window.webContents.sendInputEvent({type:'char',keyCode:ch});await new Promise(resolve=>setTimeout(resolve,10));}};
  const selectEnd=async()=>ui(`const el=document.querySelector('#item-body');el.focus();const range=document.createRange();range.selectNodeContents(el);range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range);`);
  const bodyMenu=async(action:string,selector?:string)=>{
    const popup=Menu.prototype.popup;let captured:Menu|undefined;
    Menu.prototype.popup=function(options){captured=this;const item=this.getMenuItemById(action);assert.ok(item?.enabled,`Missing or disabled body menu command: ${action}`);item.click(item,window,{} as Electron.KeyboardEvent);options?.callback?.();};
    try{await ui(selector?`const target=document.querySelector(${JSON.stringify(selector)}),r=target.getBoundingClientRect();target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:r.left+2,clientY:r.top+r.height/2}));`:`document.querySelector('#item-body').dispatchEvent(new KeyboardEvent('keydown',{key:'F10',shiftKey:true,bubbles:true,cancelable:true}));`);await wait(()=>!!captured);await new Promise(resolve=>setTimeout(resolve,40));return captured!;}finally{Menu.prototype.popup=popup;}
  };
  if(stage==='phase4-create'){
    const theme=db.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'本文と検索テーマ'}}).theme!;
    const ref={kind:'new-item' as const,id:randomUUID()};let item=db.commit({ref,token:randomUUID(),baseRevision:0,fields:{title:'本文と画像のページ',themeId:theme.id,originId:null}}).item!;
    const {id:_id,revision,createdAt:_created,updatedAt:_updated,archived:_archived,...fields}=item;
    item=db.commit({ref:{kind:'item',id:item.id},token:randomUUID(),baseRevision:revision,fields:{...fields,body:'以前の本文\n\n末尾の改行\n'}}).item!;
    const cancelled=db.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title:'中止も見つかるページ',themeId:null,originId:null}}).item!;
    db.db.prepare("UPDATE items SET state='中止' WHERE id=?").run(cancelled.id);
    const archived=db.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title:'保管したページ',themeId:null,originId:null}}).item!;db.setArchived({kind:'item',id:archived.id,archived:true,baseRevision:archived.revision});
    const original=join(root,'selected-original.png'),png=nativeImage.createFromBitmap(Buffer.alloc(64*32*4,220),{width:64,height:32}).toPNG();writeFileSync(original,png);
    const external=join(root,'search-reference.txt');writeFileSync(external,'原本本文は検索しない固有文字');
    const docs=new DocumentRepository(db);await docs.request({action:'register',entries:[{reference:external}],context:{kind:'item',id:item.id}});
    service.search.invalidate();
    await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.reload();});
    await ui(`await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));click('本文と画像のページ');await wait(()=>document.querySelector('#item-body[contenteditable=true]'));if(document.querySelector('#item-body').innerText.replace(/\\n/g,'')!=='以前の本文末尾の改行')throw Error('Legacy text changed');`);
    await new Promise(resolve=>setTimeout(resolve,600));assert.equal(db.item(item.id).revision,item.revision,'Opening must not create a save');
    await ui(`document.querySelector('#item-body').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));await input('#item-body','変換中の本文');`);
    await new Promise(resolve=>setTimeout(resolve,550));assert.equal(db.item(item.id).body,'以前の本文\n\n末尾の改行\n','Composition must not commit early');
    await ui(`document.querySelector('#item-body').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'変換中の本文'}));`);await wait(()=>db.item(item.id).body==='変換中の本文');
    const checkPlaceholder=async(expected:boolean)=>ui(`const body=document.querySelector('#item-body');const placeholders=[...body.querySelectorAll('p')].filter(p=>getComputedStyle(p,'::before').content.includes('メモを書き始める'));if(placeholders.length!==${expected?1:0})throw Error('Unexpected body placeholder: '+placeholders.length+' in '+body.innerHTML);`);
    await ui(`await input('#item-body','');document.querySelector('#item-body').focus();`);await checkPlaceholder(true);
    for(const marker of ['- ','1. ','[ ] ']){
      await type(marker);await ui(`await wait(()=>document.querySelector('#item-body li p > br'));`);await checkPlaceholder(false);
      if(marker==='- '){
        for(let line=0;line<24;line++){await window.webContents.insertText('スクロール確認 '+line);await key('Enter');}
        await ui(`const body=document.querySelector('#item-body');body.scrollTop=body.scrollHeight;await new Promise(resolve=>requestAnimationFrame(resolve));if(body.scrollTop<=0)throw Error('Body did not scroll');`);await checkPlaceholder(false);
        await screenshot('empty-list-scrolled.png');
        await ui(`document.querySelector('#item-body').scrollTop=0;document.querySelector('#item-body').scrollIntoView();await new Promise(resolve=>requestAnimationFrame(resolve));`);await checkPlaceholder(false);
      }
      await ui(`document.querySelector('#item-body').focus();`);await key('a',['control']);await key('Backspace');await checkPlaceholder(true);
    }
    await window.webContents.insertText('入力後は補足を表示しない');await key('Enter');await checkPlaceholder(false);
    await ui(`await input('#item-body','');document.querySelector('#item-body').focus();`);await checkPlaceholder(true);
    console.log('BODY_PLACEHOLDER_OK empty paragraph, blank lists, scroll, nonempty body');
    await type('# ');
    await ui(`await wait(()=>document.querySelector('#item-body h1'));`);await window.webContents.insertText('Markdownからの見出し');await key('Enter');await type('## ');await ui(`await wait(()=>document.querySelector('#item-body h2'));`);await window.webContents.insertText('二段目の見出し');await key('Enter');await type('- ');await window.webContents.insertText('箇条書きの記録');await key('Enter');await key('Enter');await type('1. ');await window.webContents.insertText('番号のある記録');await key('Enter');await key('Enter');await type('[ ] ');await window.webContents.insertText('独立ページにする確認');
    await ui(`await wait(()=>document.querySelector('#item-body ul[data-type=taskList]'));document.querySelector('#item-body input[type=checkbox]').click();await wait(()=>document.querySelector('#item-body li[data-checked=true]'));`);
    await wait(()=>!!db.item(item.id).bodyJson&&db.item(item.id).body.includes('独立ページにする確認'));
    await ui(`const li=document.querySelector('#item-body li[data-checked]'),checkbox=li.querySelector('input').getBoundingClientRect(),text=li.querySelector('p').getBoundingClientRect();if(Math.abs(checkbox.top-text.top)>12)throw Error('Task checkbox and text are not on the same line');`);
    await bodyMenu('split');
    await ui(`await wait(()=>document.querySelector('#related-page-title'));if(document.querySelector('#related-page-title').value!=='独立ページにする確認')throw Error('Wrong task title');click('作成して追加');await wait(()=>!document.querySelector('dialog'));if(document.querySelector('.item-title').value!=='本文と画像のページ')throw Error('Task extraction navigated away');`);
    assert.equal(find('独立ページにする確認').state,'未着手');assert.equal(find('独立ページにする確認').themeId,theme.id);
    await selectEnd();await key('Enter');await key('Enter');await window.webContents.insertText('参照リンク');
    await ui(`const p=[...document.querySelectorAll('#item-body p')].find(p=>p.textContent==='参照リンク');const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);await new Promise(resolve=>setTimeout(resolve,50));`);
    await bodyMenu('link');
    await ui(`await wait(()=>document.querySelector('[aria-label="本文リンクURL"]'));await input('[aria-label="本文リンクURL"]','https://example.com/reference');click('適用');await wait(()=>!document.querySelector('dialog'));await wait(()=>document.querySelector('#item-body a'));`);
    await selectEnd();await key('Enter');
    const choose=dialog.showOpenDialog;dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[original]})) as typeof dialog.showOpenDialog;
    try{await bodyMenu('image');await ui(`await wait(()=>document.querySelector('#item-body img')?.complete&&document.querySelector('#item-body img')?.naturalWidth===64);`);}finally{dialog.showOpenDialog=choose;}
    renameSync(original,join(root,'moved-original.png'));
    await ui(`document.querySelector('#item-body img').click();await wait(()=>document.querySelector('.image-preview-dialog img')?.naturalWidth===64);document.querySelector('dialog [aria-label="閉じる"]').click();await wait(()=>!document.querySelector('dialog'));`);
    await screenshot('phase4-body-light.png');await screenshot('phase4-body-dark.png');nativeTheme.themeSource='light';
    const attachments=join(root,'attachments'),held=join(root,'attachments-held');renameSync(attachments,held);writeFileSync(attachments,'test blocked directory');
    try{
      await ui(`const files=new DataTransfer();files.items.add(new File([new Uint8Array(${JSON.stringify([...png])})],'pasted.png',{type:'image/png'}));document.querySelector('#item-body').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:files}));await wait(()=>document.querySelector('.body-image-pending .error-text'));if(document.querySelectorAll('#item-body img').length!==1)throw Error('Failed image inserted');`);
      const show=dialog.showMessageBox;let prompt:Electron.MessageBoxOptions|undefined;
      dialog.showMessageBox=(async(...args:unknown[])=>{prompt=args.at(-1) as Electron.MessageBoxOptions;return {response:0,checkboxChecked:false};}) as typeof dialog.showMessageBox;
      try{window.close();await wait(()=>!!prompt);assert.ok(!prompt!.buttons!.includes('下書きを残して終了'));assert.equal(window.isDestroyed(),false);}finally{dialog.showMessageBox=show;}
      await ui(`click('HOME');await wait(()=>document.querySelector('.error-banner')?.textContent.includes('画像'));`);
    }finally{unlinkSync(attachments);renameSync(held,attachments);}
    await ui(`click('ページで確認');await wait(()=>document.querySelector('#item-body'));click('画像を再試行');await wait(()=>document.querySelectorAll('#item-body img').length===2);await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
    assert.equal(readdirSync(attachments).filter(name=>name.endsWith('.png')).length,2);
    assert.equal(readFileSync(join(root,'moved-original.png')).equals(png),true);
    await ui(`for(const bytes of [new Uint8Array([1,2,3]),new Uint8Array(20*1024*1024+1)]){const result=await window.workspace.images({action:'import',bytes});if(result.ok)throw Error('Invalid image accepted');}const unsafe=await window.workspace.images({action:'open-link',href:'javascript:alert(1)'});if(unsafe.ok)throw Error('Unsafe body link accepted');`);
    const jpeg=nativeImage.createFromBuffer(png).toJPEG(90);
    const converted=await ui(`const result=await window.workspace.images({action:'import',bytes:new Uint8Array(${JSON.stringify([...jpeg])})});if(!result.ok||result.value.width!==64)throw Error('JPEG conversion failed');return result.value;`) as {id:string};
    assert.equal(nativeImage.createFromBuffer(readFileSync(join(root,'attachments',`${converted.id}.png`))).getSize().width,64);
    await ui(`const files=new DataTransfer();files.items.add(new File([new Uint8Array([1,2,3])],'invalid.png',{type:'image/png'}));document.querySelector('#item-body').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:files}));await wait(()=>document.querySelector('.body-image-pending .error-text'));click('未保存の画像を破棄');await wait(()=>document.querySelector('dialog'));click('画像入力を破棄');await wait(()=>!document.querySelector('dialog'));await wait(()=>!document.querySelector('.body-image-pending'));if(document.querySelectorAll('#item-body img').length!==2)throw Error('Discard changed saved images');`);
    // Backups retain both saved images and the structured body.
    await ui(`click('設定');await wait(()=>document.querySelector('.settings-section'));click('バックアップを作成');await wait(()=>document.querySelector('.backup-generations button'));`);
    const backup=readdirSync(join(root,'backups')).find(name=>!name.endsWith('.partial'))!;assert.equal(readdirSync(join(root,'backups',backup,'attachments')).filter(name=>name.endsWith('.png')).length,3);
    await key('k',['control']);await ui(`await wait(()=>document.querySelector('.search-dialog'));if(document.querySelector('.keyboard-active'))throw Error('Automatic search highlight');await input('[aria-label="ワークスペースを検索"]','Markdownからの見出し');await wait(()=>document.querySelector('[role=option]')?.textContent.includes('本文と画像のページ'));`);await key('ArrowDown');await key('Enter');
    await ui(`await wait(()=>!document.querySelector('dialog'));await wait(()=>document.querySelector('.item-title')?.value==='本文と画像のページ');click('検索');await wait(()=>document.querySelector('.search-dialog'));await input('[aria-label="ワークスペースを検索"]','中止も見つかる');await wait(()=>document.querySelector('[role=option]')?.textContent.includes('中止も見つかるページ'));`);
    await screenshot('phase4-search-light.png');await key('Escape');await ui(`await wait(()=>!document.querySelector('dialog'));if(document.querySelector('.item-title').value!=='本文と画像のページ')throw Error('Esc changed route');click('検索');await wait(()=>document.querySelector('.search-dialog'));await input('[aria-label="ワークスペースを検索"]','保管したページ');await wait(()=>document.querySelector('.global-search-results').textContent.includes('一致する対象はありません'));document.querySelector('.global-search-options input').click();await wait(()=>document.querySelector('[role=option]')?.textContent.includes('保管したページ'));document.querySelector('[role=option]').click();await wait(()=>!document.querySelector('dialog'));await wait(()=>document.querySelector('.item-title')?.value==='保管したページ');if(document.querySelector('#item-body').isContentEditable)throw Error('Archived body editable');`);
    const originalQuery=service.search.request;service.search.request=()=>{throw Error('test search failure');};
    try{await ui(`click('検索');await wait(()=>document.querySelector('.search-dialog'));await input('[aria-label="ワークスペースを検索"]','検索語を保持');await wait(()=>document.querySelector('.search-dialog [role=alert]'));if(document.querySelector('[aria-label="ワークスペースを検索"]').value!=='検索語を保持')throw Error('Query lost');`);}finally{service.search.request=originalQuery;}
    await ui(`click('検索を再試行');await wait(()=>document.querySelector('.global-search-results').textContent.includes('一致する対象はありません'));await input('[aria-label="ワークスペースを検索"]','原本本文は検索しない固有文字');await wait(()=>document.querySelector('.global-search-results').textContent.includes('一致する対象はありません'));await input('[aria-label="ワークスペースを検索"]','search-reference.txt');await wait(()=>document.querySelector('[role=option]'));`);
    const open=shell.openPath,opened:string[]=[];shell.openPath=async path=>{opened.push(path);return '';};try{await key('ArrowDown');await key('Enter');await ui(`await wait(()=>!document.querySelector('dialog'));`);assert.deepEqual(opened,[external]);}finally{shell.openPath=open;}
    assert.ok(existsSync(join(root,'moved-original.png')));
  }else if(stage==='phase4-restart'){
    const item=find('本文と画像のページ');assert.ok(item.bodyJson);assert.ok(bodyText(parseBody(item.bodyJson!)).includes('Markdownからの見出し'));
    await ui(`click('本文と画像のページ');await wait(()=>document.querySelectorAll('#item-body img').length===2&&document.querySelector('#item-body img').naturalWidth===64);if(!document.querySelector('#item-body h1')||!document.querySelector('#item-body li[data-checked=true]')||!document.querySelector('#item-body a'))throw Error('Rich structure lost on restart');click('検索');await wait(()=>document.querySelector('.global-search-result'));if(!document.querySelector('.global-search-results').textContent.includes('search-reference.txt'))throw Error('Recent document not persisted');`);await key('Escape');
    await bodyMenu('delete-image','#item-body img');
    await ui(`await wait(()=>document.querySelectorAll('#item-body img').length===1);await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
    assert.equal(readdirSync(join(root,'attachments')).filter(name=>name.endsWith('.png')).length,3,'Deleting a reference must retain recovery images');
  }else if(stage==='phase4-crash'){
    await ui(`click('本文と画像のページ');await wait(()=>document.querySelector('#item-body'));`);service.database.db.exec('PRAGMA query_only=ON');await selectEnd();await key('Enter');await window.webContents.insertText('異常終了から戻す本文');
    await ui(`await wait(()=>document.querySelector('.error-banner'));if(!document.querySelector('#item-body').textContent.includes('異常終了から戻す本文'))throw Error('Failed body lost');`);
    await wait(()=>service.journal.list().some(draft=>'bodyJson' in draft.fields&&!!draft.fields.bodyJson?.includes('異常終了から戻す本文')));console.log('PHASE4_RICH_DRAFT_PROTECTED');app.exit(17);return;
  }else if(stage==='phase4-recover'){
    await ui(`await wait(()=>document.querySelector('.recovery-panel'));click('復旧する');await wait(()=>document.querySelector('#item-body')?.textContent.includes('異常終了から戻す本文'));await wait(()=>document.querySelector('#item-body img')?.naturalWidth===64);if(!document.querySelector('#item-body h1')||!document.querySelector('#item-body li[data-checked=true]'))throw Error('Recovered formatting lost');`);
    await selectEnd();await key('Enter');await window.webContents.insertText('終了直前の本文保存');await screenshot('phase4-recovered.png');
  }else if(stage==='phase4-close-restart'){
    assert.ok(find('本文と画像のページ').body.includes('終了直前の本文保存'));
    await ui(`const result=await window.workspace.getWorkspace();if(!result.ok||result.value.drafts.length)throw Error('Committed rich draft recovered again');`);
  }else if(stage==='phase4-body-menu'){
    await ui(`click('本文と画像のページ');await wait(()=>document.querySelector('#item-body'));if(document.querySelector('[role=toolbar],.body-toolbar,.body-markdown-hint'))throw Error('Persistent formatting toolbar remains');const p=[...document.querySelectorAll('#item-body p')].find(p=>p.textContent.includes('終了直前の本文保存'));document.querySelector('#item-body').focus();const range=document.createRange();range.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(range);await new Promise(resolve=>setTimeout(resolve,50));`);
    const bold=await bodyMenu('bold','#item-body p:last-child');assert.equal(bold.getMenuItemById('bold')!.checked,true);
    await ui(`await wait(()=>[...document.querySelectorAll('#item-body strong')].some(el=>el.textContent.includes('終了直前の本文保存')));`);
    const italic=await bodyMenu('italic');assert.ok(italic.getMenuItemById('bold')!.checked);
    await ui(`await wait(()=>document.querySelector('#item-body strong em,#item-body em strong'));`);
    await bodyMenu('undo');await ui(`await wait(()=>!document.querySelector('#item-body em'));`);
    await bodyMenu('redo');await ui(`await wait(()=>document.querySelector('#item-body em'));`);
    await bodyMenu('heading-3');await ui(`await wait(()=>document.querySelector('#item-body h3'));`);
    await bodyMenu('paragraph');await ui(`await wait(()=>!document.querySelector('#item-body h3'));`);
    await bodyMenu('bullet');await ui(`await wait(()=>[...document.querySelectorAll('#item-body > ul:not([data-type])')].some(el=>el.textContent.includes('終了直前の本文保存')));`);
    await bodyMenu('ordered');await ui(`await wait(()=>[...document.querySelectorAll('#item-body ol')].some(el=>el.textContent.includes('終了直前の本文保存')));`);
    await bodyMenu('task');await ui(`await wait(()=>[...document.querySelectorAll('#item-body ul[data-type=taskList]')].some(el=>el.textContent.includes('終了直前の本文保存')));`);
    await bodyMenu('paragraph');
    const popup=Menu.prototype.popup;let opened=false,closed=false;
    Menu.prototype.popup=function(options){opened=true;popup.call(this,{...options,callback:()=>{closed=true;options?.callback?.();}});setTimeout(()=>this.closePopup(window),200);};
    try{await key('F10',['shift']);await wait(()=>opened&&closed);}finally{Menu.prototype.popup=popup;}
    await screenshot('body-without-toolbar.png');
    await ui(`click('アーカイブ');await wait(()=>document.querySelector('dialog'));click('実行する');await wait(()=>document.querySelector('#item-body[contenteditable=false]'));`);
    const readonly=await bodyMenu('zoom-image','#item-body img');assert.equal(readonly.getMenuItemById('bold'),null);assert.ok(!readonly.items.some(item=>['cut','paste'].includes(item.role??'')));
    await ui(`await wait(()=>document.querySelector('.image-preview-dialog'));document.querySelector('dialog [aria-label="閉じる"]').click();await wait(()=>!document.querySelector('dialog'));click('ページを復元');await wait(()=>document.querySelector('#item-body[contenteditable=true]'));`);
    console.log('BODY_CONTEXT_MENU_OK selection, formatting, undo, lists, readonly, native popup');
  }else if(stage==='phase4-menu-visual'){
    let item=find('本文と画像のページ');
    if(!item){
      const theme=db.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'右クリックの表示確認'}}).theme!;
      item=db.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title:'本文と画像のページ',themeId:theme.id,originId:null}}).item!;
      db.db.prepare('UPDATE items SET body=?,bodyJson=? WHERE id=?').run('測定条件の確認\n選択した文章の書式を変更します。',JSON.stringify({type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'測定条件の確認'}]},{type:'paragraph',content:[{type:'text',text:'選択した文章の書式を変更します。'}]}]}),item.id);
      await new Promise<void>(resolve=>{window.webContents.once('did-finish-load',()=>resolve());window.reload();});
    }
    await ui(`await wait(()=>(document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));await wait(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='本文と画像のページ'));click('本文と画像のページ');await wait(()=>document.querySelector('#item-body'));`);
    window.setTitle('Redia — メニュー表示テスト');
    console.log(`BODY_MENU_VISUAL_READY ${root}`);
    await new Promise<void>(resolve=>window.once('closed',()=>resolve()));
  }else if(stage==='phase4-performance'){
    db.db.exec('BEGIN');try{
      const theme=db.db.prepare('INSERT INTO themes(id,name,description,createdAt,updatedAt) VALUES (?,?,?,?,?)'),page=db.db.prepare('INSERT INTO items(id,title,state,themeId,body,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)'),doc=db.db.prepare('INSERT INTO documents(id,name,reference,normalized,kind,description,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)');
      const themes=Array.from({length:100},(_,i)=>{const id=randomUUID();theme.run(id,`性能テーマ ${i}`,'日本語の照合テスト','2026','2026');return id;});
      for(let i=0;i<10000;i++)page.run(randomUUID(),`性能ページ ${i}`,'未着手',themes[i%100]!,`本文の記録 ${i} `+'測定条件と装置の校正を確認する。'.repeat(140),'2026','2026');
      for(let i=0;i<5000;i++)doc.run(randomUUID(),`性能資料 ${i}`,`https://example.com/performance/${i}`,`https://example.com/performance/${i}`,'url','温度の測定手順','2026','2026');db.db.exec('COMMIT');
    }catch(error){db.db.exec('ROLLBACK');throw error;}service.search.invalidate();
    await ui(`await window.workspace.search({action:'query',query:'性能',includeArchived:false});`);
    const times=await ui(`const times=[];for(let i=0;i<50;i++){const start=performance.now();const result=await window.workspace.search({action:'query',query:['性能ページ','測定条件 校正','性能資料','性能テーマ','見つからない語'][i%5],includeArchived:false});if(!result.ok)throw Error('Search benchmark failed');times.push(performance.now()-start);}return times.sort((a,b)=>a-b);`) as number[];
    const p95=times[Math.ceil(times.length*.95)-1]!;assert.ok(p95<=200,`Search p95 ${p95} ms`);writeFileSync(join(root,'search-performance.json'),JSON.stringify({pages:10000,themes:100,documents:5000,queries:50,p95,times},null,2));
    await ui(`click('検索');await wait(()=>document.querySelector('.search-dialog'));const start=performance.now();await input('[aria-label="ワークスペースを検索"]','性能ページ');await wait(()=>document.querySelectorAll('[role=option]').length===50);if(performance.now()-start>650)throw Error('Result paint exceeded 500ms plus debounce');`);
    await screenshot('phase4-search-many.png');await key('Escape');console.log(`PHASE4_SEARCH_P95_MS ${p95.toFixed(2)}`);
  }
  console.log(`PHASE4_OK ${stage}`);
}
