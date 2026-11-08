import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WorkspaceService } from '../src/main/service.ts';
import { migrate, migrations } from '../src/main/db/migrations.ts';
import { bodyText, imageSource, itemBody, parseBody, plainBody } from '../src/shared/body.ts';
import { SearchStore } from '../src/renderer/search-store.ts';
import { validateDraft } from '../src/shared/validation.ts';
import type { SearchResponse } from '../src/shared/search.ts';

test('structured body preserves legacy newlines, formatting, checks and managed references while rejecting active content',()=>{
  const legacy='# 以前からある文字\n\n末尾の改行\n';assert.equal(bodyText(itemBody({body:legacy})),legacy);
  const doc={type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'見出し'}]},{type:'taskList',content:[{type:'taskItem',attrs:{checked:true},content:[{type:'paragraph',content:[{type:'text',text:'確認する',marks:[{type:'bold'}]}]}]}]},{type:'image',attrs:{src:imageSource(randomUUID())}}]};
  assert.deepEqual(parseBody(JSON.stringify(doc)),doc);assert.equal(bodyText(doc),'見出し\n確認する\n');
  assert.doesNotThrow(()=>parseBody(JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'参照',marks:[{type:'link',attrs:{href:'https://example.com',target:'_blank',rel:'noopener noreferrer',class:null,title:null}}]}]}]})));
  for(const node of [{type:'script',text:'alert(1)'},{type:'image',attrs:{src:'https://example.com/x.png'}},{type:'image',attrs:{src:'file:///etc/passwd'}},{type:'paragraph',content:[{type:'text',text:'x',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]},{type:'paragraph',attrs:{style:'color:red'}},{type:'text',text:'wrong root child'}])assert.throws(()=>parseBody(JSON.stringify({type:'doc',content:[node]})));
  const parsed=validateDraft({ref:{kind:'item',id:randomUUID()},token:randomUUID(),baseRevision:1,fields:{title:'ページ',state:'未着手',themeId:null,summary:'',body:'検索へ混入させない',bodyJson:JSON.stringify(doc),dueDate:null,reviewDate:null}});
  assert.equal('body' in parsed.fields&&parsed.fields.body,bodyText(doc));
  const large=JSON.stringify(plainBody('長'.repeat(4*1024*1024)));
  assert.throws(()=>parseBody(large));assert.equal(bodyText(itemBody({body:'',bodyJson:large})).length,4*1024*1024);
});

test('v4 data upgrades without altering plain body or existing states; structured body and search survive reopen',async()=>{
  mkdirSync('test-artifacts',{recursive:true});const root=mkdtempSync(resolve('test-artifacts/phase4-db-'));
  const paths={database:join(root,'workspace.sqlite'),drafts:join(root,'drafts'),attachments:join(root,'attachments'),backups:join(root,'backups')};for(const dir of [paths.drafts,paths.attachments,paths.backups])mkdirSync(dir);
  const id=randomUUID(),themeId=randomUUID(),documentId=randomUUID(),legacy='既存本文\n二行目\n';
  const db=new DatabaseSync(paths.database);migrate(db,migrations.slice(0,4));
  db.prepare('INSERT INTO themes(id,name,description,createdAt,updatedAt) VALUES (?,?,?,?,?)').run(themeId,'試験テーマ','テーマの説明で探す','2020','2020');
  db.prepare('INSERT INTO items(id,title,state,themeId,body,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run(id,'完了したページ','完了',themeId,legacy,'2020','2020');
  db.prepare('INSERT INTO documents(id,name,reference,normalized,kind,description,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)').run(documentId,'資料の名前','https://example.com/reference','https://example.com/reference','url','資料の説明','2020','2020');
  db.prepare('INSERT INTO document_uses(documentId,kind,contextId,memo,position) VALUES (?,?,?,?,?)').run(documentId,'item',id,'用途の単語',1);db.close();
  let service=new WorkspaceService(paths);
  assert.equal(service.database.item(id).body,legacy);assert.equal(service.database.item(id).bodyJson,null);assert.equal(service.database.item(id).state,'完了');
  const search=(query:string,includeArchived=false)=>service.search.request({action:'query',query,includeArchived})!;
  assert.equal(search('説明で探す').results[0]!.kind,'theme');assert.equal(search('二行目').results[0]!.id,id);assert.equal(search('用途の単語').results[0]!.id,documentId);assert.equal(search('HTTPS://EXAMPLE.COM/REFERENCE').results[0]!.kind,'document');
  service.search.request({action:'remember',target:{kind:'item',id}});assert.equal(search('').results[0]!.id,id);
  const current=service.database.item(id),doc=plainBody('更新した文字');
  const {id:_id,revision,createdAt:_created,updatedAt:_updated,archived:_archived,...fields}=current;
  service.database.commit({ref:{kind:'item',id},token:randomUUID(),baseRevision:revision,fields:{...fields,bodyJson:JSON.stringify(doc)}});service.search.invalidate();
  assert.equal(search('二行目').total,0);assert.equal(search('更新した文字').results[0]!.id,id);
  const missing={ref:{kind:'item' as const,id},token:randomUUID(),baseRevision:service.database.item(id).revision,fields:{...fields,bodyJson:JSON.stringify({type:'doc',content:[{type:'image',attrs:{src:imageSource(randomUUID())}}]})}};
  assert.equal((await service.request('stageDraft',missing)).ok,true);assert.equal((await service.request('commitDraft',{ref:missing.ref,token:missing.token})).ok,false);
  assert.equal(service.database.item(id).body,'更新した文字');assert.equal(service.journal.list().length,1);await service.request('discardDraft',{ref:missing.ref,token:missing.token});
  service.database.setArchived({kind:'theme',id:themeId,archived:true,baseRevision:service.database.theme(themeId).revision});service.search.invalidate();
  assert.equal(search('更新した文字').total,0);assert.equal(search('更新した文字',true).results[0]!.archived,true);
  assert.throws(()=>service.search.request({action:'query',query:'x',includeArchived:false,extra:true}));
  await service.close();service=new WorkspaceService(paths);assert.equal(service.database.item(id).bodyJson,JSON.stringify(doc));assert.equal(search('',true).results[0]!.id,id);await service.close();
});

test('search discards slow replies and preserves query and archive choice after errors',async()=>{
  const callbacks:((value:{ok:true;value:SearchResponse})=>void)[]=[];
  const store=new SearchStore(()=>new Promise(resolve=>callbacks.push(resolve)));
  const old=store.load();store.change({query:'新しい検索',includeArchived:true});const latest=store.load();
  callbacks[1]!({ok:true,value:{total:0,results:[]}});await latest;
  callbacks[0]!({ok:true,value:{total:1,results:[{kind:'item',id:randomUUID(),title:'古い結果',detail:'',excerpt:'',archived:false}]}});await old;
  assert.equal(store.getSnapshot().data.total,0);assert.equal(store.getSnapshot().query,'新しい検索');assert.equal(store.getSnapshot().includeArchived,true);store.cancel();
  const broken=new SearchStore(async()=>({ok:false,error:{code:'STORAGE_FAILED',message:'試験障害'}}));broken.change({query:'入力を残す',includeArchived:true});await broken.load();assert.equal(broken.getSnapshot().error,'試験障害');assert.equal(broken.getSnapshot().query,'入力を残す');assert.equal(broken.getSnapshot().includeArchived,true);broken.cancel();
});
