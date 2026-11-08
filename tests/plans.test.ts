import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,readFileSync,renameSync,writeFileSync,unlinkSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WorkspaceService } from '../src/main/service.ts';
import { emptyPlan,validatePlanDraft,saveBaseline,dragDates,shiftDate,movePlan,timelineTicks } from '../src/shared/plans.ts';
import type { PlanRow,PlanResponse,PlanRequest } from '../src/shared/plans.ts';
import { PlanStore } from '../src/renderer/plan-store.ts';
import type { Result } from '../src/shared/model.ts';

function setup(){mkdirSync('test-artifacts',{recursive:true});const root=mkdtempSync(resolve('test-artifacts/plan-db-'));const paths={database:join(root,'workspace.sqlite'),drafts:join(root,'drafts'),attachments:join(root,'attachments'),backups:join(root,'backups')};for(const directory of [paths.drafts,paths.attachments,paths.backups])mkdirSync(directory);return {root,paths,service:new WorkspaceService(paths)};}
test('plan dates allow unset/one-sided/milestones, enforce actual dates, and preserve baseline when moving latest schedule',()=>{
  const row={...emptyPlan('計画'),start:'2026-01-30',end:'2026-02-02'};const baseline=saveBaseline([row],null)[0];
  assert.equal(dragDates(baseline,2,'move').start,'2026-02-01');assert.equal(dragDates(baseline,2,'move').baselineStart,'2026-01-30');
  assert.equal(dragDates(row,30,'start').start,row.end);assert.equal(dragDates(row,-30,'end').end,row.start);
  assert.equal(shiftDate('2024-02-28',1),'2024-02-29');assert.equal(shiftDate('2025-02-28',1),'2025-03-01');
  assert.deepEqual(timelineTicks('2024-01-30',40,'month'),[{offset:2,label:'2024-02'},{offset:31,label:'2024-03'}]);assert.throws(()=>shiftDate('0001-01-01',-1));assert.throws(()=>shiftDate('9999-12-31',1));
  const valid=(patch:Partial<PlanRow>)=>validatePlanDraft({baseRevision:0,token:randomUUID(),rows:[{...row,...patch}]},true,'2026-02-02');
  for(const patch of [{start:null,end:null},{start:null,end:'2026-02-02'},{start:'2026-02-02',end:null},{start:'2026-02-02',end:'2026-02-02'},{actualStart:'2026-02-01',actualEnd:null}])assert.doesNotThrow(()=>valid(patch));
  for(const patch of [{start:'2026-02-30'},{start:'2026-02-03'},{actualStart:null,actualEnd:'2026-02-02'},{actualStart:'2026-02-03'},{actualStart:'2026-02-02',actualEnd:'2026-02-01'},{actualStart:'2026-02-01',actualEnd:'2026-02-03'}])assert.throws(()=>valid(patch));
  assert.throws(()=>validatePlanDraft({baseRevision:0,token:randomUUID(),rows:[row,row]}));assert.throws(()=>validatePlanDraft({baseRevision:0,token:randomUUID(),rows:[{...row,priority:1}]}));
});
test('plans save independently, link many pages to many rows, baseline includes hidden rows, retry is idempotent, and rollback preserves data',async()=>{
  const {service,paths}=setup();const db=service.database;
  const theme=db.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'テーマ'}}).theme!;
  const items=[0,1].map(i=>db.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title:'ページ'+i,themeId:theme.id,originId:null}}).item!);
  const before=JSON.stringify(db.items());let rows=[{...emptyPlan('行A',theme.id,items.map(i=>i.id)),start:'2026-01-01',end:'2026-01-02'},emptyPlan('隠れた行',theme.id,[items[0].id]),emptyPlan('別テーマ')];
  const save=(rows:PlanRow[],revision:number)=>{const token=randomUUID();service.plans.request({action:'stage',draft:{rows,token,baseRevision:revision}});return {token,result:service.plans.request({action:'commit',token})};};
  let result=save(rows,0).result;rows=saveBaseline(rows,theme.id);result=save(rows,result.revision).result;
  rows=rows.map(r=>r.id===rows[0].id?{...r,start:'2026-01-05',end:'2026-01-06'}:r);const applied=save(rows,result.revision);assert.equal(applied.result.rows[0].baselineStart,'2026-01-01');assert.equal(applied.result.rows[0].actualStart,null);
  assert.equal(service.plans.request({action:'commit',token:applied.token}).revision,applied.result.revision);
  assert.equal(JSON.stringify(db.items()),before);
  const invalid={rows:[{...rows[0],actualStart:'9999-01-01'}],token:randomUUID(),baseRevision:applied.result.revision};service.plans.request({action:'stage',draft:invalid});assert.throws(()=>service.plans.request({action:'commit',token:invalid.token}));assert.equal(service.plans.snapshot().rows.length,3);assert.ok(service.plans.draft());
  const token=randomUUID();service.plans.request({action:'stage',draft:{rows:movePlan(rows,rows[0].id,rows[1].id),token,baseRevision:applied.result.revision}});
  db.db.exec("CREATE TRIGGER fail_plan BEFORE UPDATE ON plan_state BEGIN SELECT RAISE(ABORT,'test'); END");assert.throws(()=>service.plans.request({action:'commit',token}));assert.equal(service.plans.snapshot().revision,applied.result.revision);db.db.exec('DROP TRIGGER fail_plan');
  assert.equal(service.plans.request({action:'commit',token}).rows[0].id,rows[1].id);
  await service.close();const reopened=new WorkspaceService(paths);assert.equal(reopened.plans.snapshot().rows[0].id,rows[1].id);assert.equal(JSON.stringify(reopened.database.items()),before);await reopened.close();
});
test('invalid plan input persists as a recovery draft through restart and is included in backup',async()=>{
  const {service,paths}=setup();const draft={baseRevision:0,token:randomUUID(),rows:[{...emptyPlan('入力保持'),start:'2026-02-03',end:'2026-02-01'}]};
  await service.request('plans',{action:'stage',draft});const failed=await service.request('plans',{action:'commit',token:draft.token});assert.equal(failed.ok,false);
  const backup=await service.request('createBackup',null);assert.equal(backup.ok,true);if(backup.ok){const manifest=JSON.parse(readFileSync(join(paths.backups,(backup.value as {name:string}).name,'manifest.json'),'utf8'));assert.ok(manifest.files.some((f:{path:string})=>f.path.includes('plans.json')));}
  await service.close();const next=new WorkspaceService(paths);assert.deepEqual(next.plans.request({action:'load'}).draft,draft);next.plans.request({action:'discard',token:draft.token});assert.equal(next.plans.request({action:'load'}).draft,undefined);await next.close();
});
test('baseline replacement spans a whole theme, later rows start without a baseline, archived rows and conflicting drafts stay protected',async()=>{
  const {service}=setup(),db=service.database,repo=service.plans;
  const theme=db.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'基準対象'}}).theme!;
  const other=db.commit({ref:{kind:'new-theme',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{name:'対象外'}}).theme!;
  const rows=[{...emptyPlan('表示行',theme.id),start:'2026-01-01',end:'2026-01-03'},{...emptyPlan('非表示行',theme.id),end:'2026-01-05'},{...emptyPlan('他テーマ',other.id),start:'2026-01-02'}];
  const save=(rows:PlanRow[],baseRevision=repo.snapshot().revision)=>{const token=randomUUID();repo.request({action:'stage',draft:{baseRevision,rows,token}});return repo.request({action:'commit',token});};
  save(rows);const baseline=save(saveBaseline(rows,theme.id));assert.equal(baseline.rows[1].baselineEnd,'2026-01-05');assert.equal(baseline.rows[2].baselineStart,null);
  const later=emptyPlan('後で追加',theme.id);const next=save([...baseline.rows,later]);assert.equal(next.rows[3].baselineStart,null);
  const replacement=save(saveBaseline(next.rows.map(row=>row.id===rows[0].id?{...row,start:'2026-01-02'}:row),theme.id));assert.equal(replacement.rows[0].baselineStart,'2026-01-02');
  assert.throws(()=>save([],0));assert.equal(repo.snapshot().rows.length,4);assert.ok(repo.draft());
  db.setArchived({kind:'theme',id:theme.id,archived:true,baseRevision:theme.revision});assert.throws(()=>save(replacement.rows.filter(row=>row.themeId!==theme.id)));assert.equal(repo.snapshot().rows.length,4);
  db.setArchived({kind:'theme',id:theme.id,archived:false,baseRevision:db.theme(theme.id).revision});save(replacement.rows);await service.close();
});
test('plan editor protects newer input from delayed saves, holds IME, preserves errors, and supports undo/redo',async()=>{
  let revision=0;let staged:any;let unblock:((value:Result<PlanResponse>)=>void)|undefined;let block=true;let fail=false;
  const api={plans:async(input:PlanRequest):Promise<Result<PlanResponse>>=>{if(input.action==='load')return {ok:true,value:{rows:[],revision}};if(input.action==='stage'){staged=input.draft;return {ok:true,value:{rows:[],revision}};}if(input.action==='commit'){if(fail)return {ok:false,error:{code:'STORAGE_FAILED',message:'保存失敗'}};if(block){block=false;return await new Promise(resolve=>{unblock=resolve;});}return {ok:true,value:{rows:staged.rows,revision:++revision}};}return {ok:true,value:{rows:[],revision}};}};
  const store=new PlanStore(api);await store.load();const row=emptyPlan('先の入力');store.change([row]);const pending=store.save();await new Promise(resolve=>setTimeout(resolve,0));store.update(row.id,{title:'新しい入力'});unblock!({ok:true,value:{rows:[row],revision:++revision}});await pending;assert.equal(store.getSnapshot().rows[0].title,'新しい入力');assert.equal((await store.flush()).ready,true);
  store.update(row.id,{title:'変換中'},true);assert.equal((await store.flush()).ready,false);assert.equal(store.getSnapshot().safe,true);store.update(row.id,{title:'変換確定'});fail=true;assert.equal((await store.flush()).ready,false);assert.equal(store.getSnapshot().rows[0].title,'変換確定');assert.equal(store.getSnapshot().safe,true);fail=false;assert.equal((await store.flush()).ready,true);
  store.undo();assert.equal(store.getSnapshot().rows[0].title,'変換中');store.redo();assert.equal(store.getSnapshot().rows[0].title,'変換確定');await store.flush();
});
test('plan view validation, persistence and retry preserve the newest query and scroll position',async()=>{
  const {service,paths}=setup();const api={plans:async(input:PlanRequest)=>await service.request('plans',input) as Result<PlanResponse>};
  const store=new PlanStore(api);await store.load();store.patchView({query:'比較',scale:'month',compare:true,scrollLeft:123,scrollTop:45});assert.equal((await store.flush()).ready,true);
  const saved=service.plans.request({action:'load'}).view!;assert.equal(saved.query,'比較');assert.equal(saved.scrollLeft,123);
  assert.throws(()=>service.plans.request({action:'view',view:{...saved,scrollLeft:-1}}));assert.throws(()=>service.plans.request({action:'view',view:{...saved,theme:'injected'}}));
  service.database.db.exec('PRAGMA query_only=ON');store.patchView({query:'失敗中の検索'});assert.equal((await store.flush()).ready,false);assert.equal(store.getSnapshot().view.query,'失敗中の検索');service.database.db.exec('PRAGMA query_only=OFF');assert.equal((await store.flush()).ready,true);await service.close();
  const reopened=new WorkspaceService(paths);assert.equal(reopened.plans.request({action:'load'}).view?.query,'失敗中の検索');await reopened.close();
});
test('plan draft write failure keeps edits in memory and refuses a safe exit until retry succeeds',async()=>{
  const {service,paths}=setup();const store=new PlanStore({plans:async input=>await service.request('plans',input) as Result<PlanResponse>});await store.load();
  const directory=join(paths.drafts,'plans'),held=join(paths.drafts,'plans-held');renameSync(directory,held);writeFileSync(directory,'test blocked directory');
  try{store.change([emptyPlan('退避できない入力')]);const result=await store.flush();assert.equal(result.ready,false);assert.equal(result.draftsSafe,false);assert.equal(store.getSnapshot().rows[0].title,'退避できない入力');}finally{unlinkSync(directory);renameSync(held,directory);}
  assert.equal((await store.flush()).ready,true);await service.close();
});
test('a delayed plan load never replaces a query entered while loading',async()=>{
  let finish:((result:Result<PlanResponse>)=>void)|undefined;
  const store=new PlanStore({plans:async input=>input.action==='load'?await new Promise(resolve=>{finish=resolve;}):{ok:true,value:{revision:0,rows:[]}}});
  const loading=store.load();const oldView=store.getSnapshot().view;store.patchView({query:'新しい検索'});finish!({ok:true,value:{revision:0,rows:[],view:oldView}});await loading;assert.equal(store.getSnapshot().view.query,'新しい検索');assert.equal((await store.flush()).ready,true);
});
