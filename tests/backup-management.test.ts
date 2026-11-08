import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,cp,rename,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {WorkspaceService} from '../src/main/service.ts';
import {BackupManagement,applyPendingRestore,verifyBackup} from '../src/main/backup-management.ts';
import {dataPaths} from '../src/main/paths.ts';
import {randomUUID} from 'node:crypto';
test('backup hashes, independent storage, restore rollback and restart restore keep DB, images and drafts together',async()=>{
  await mkdir('test-artifacts',{recursive:true});const root=await mkdtemp(resolve('test-artifacts/restore-')),paths=dataPaths(root,'test',join(root,'app'));
  for(const dir of [join(paths.root,'database'),paths.attachments,paths.drafts,paths.backups])await mkdir(dir,{recursive:true});
  let service=new WorkspaceService(paths);const manager=new BackupManagement(paths);
  const saved=service.database.commit({ref:{kind:'new-item',id:randomUUID()},token:randomUUID(),baseRevision:0,fields:{title:'保存したページ',themeId:null,originId:null}}).item!;
  await writeFile(join(paths.attachments,'image.png'),'original image');await writeFile(join(paths.drafts,'sample.json'),'{}');
  const backup=await service.request('createBackup',null);assert.ok(backup.ok);const name=(backup.value as {name:string}).name;await verifyBackup(join(paths.backups,name));
  await assert.rejects(manager.setDirectory(paths.drafts));const external=join(root,'external');await manager.setDirectory(external);await manager.publish(name);assert.equal((await manager.list()).generations.length,1);
  await mkdir(join(external,'ignored.partial'));assert.equal((await manager.list()).generations.length,1);await assert.rejects(manager.prepare('../database'));
  await writeFile(join(paths.attachments,'image.png'),'changed image');service.database.db.prepare('UPDATE items SET title=? WHERE id=?').run('復元前のページ',saved.id);await service.close();
  await manager.prepare(name);await assert.rejects(applyPendingRestore(paths,0));service=new WorkspaceService(paths);assert.equal(service.database.items()[0].title,'復元前のページ');assert.equal(await readFile(join(paths.attachments,'image.png'),'utf8'),'changed image');await service.close();
  await manager.prepare(name);await applyPendingRestore(paths);service=new WorkspaceService(paths);assert.equal(service.database.items()[0].title,'保存したページ');assert.equal(await readFile(join(paths.attachments,'image.png'),'utf8'),'original image');assert.equal(await readFile(join(paths.drafts,'sample.json'),'utf8'),'{}');await service.close();
  // Simulate power loss after replacing only the DB directory.
  await manager.prepare(name);const pending=join(paths.root,'restore-pending');await mkdir(join(pending,'old'));await writeFile(join(pending,'install.json'),'installing');await rename(join(paths.root,'database'),join(pending,'old','database'));await rename(join(pending,'incoming','database'),join(paths.root,'database'));await applyPendingRestore(paths);service=new WorkspaceService(paths);assert.equal(service.database.items()[0].title,'保存したページ');await service.close();
  await writeFile(join(external,name,'attachments','image.png'),'corrupt');await assert.rejects(manager.prepare(name));assert.ok((await readdir(paths.root)).some(name=>name.startsWith('before-restore-')));
});
test('retention removes only verified complete old generations after publishing a new generation',async()=>{
  const root=await mkdtemp(resolve('test-artifacts/retention-')),paths=dataPaths(root,'test',root);for(const dir of [join(root,'database'),paths.attachments,paths.drafts,paths.backups])await mkdir(dir,{recursive:true});const service=new WorkspaceService(paths),manager=new BackupManagement(paths);const backup=await service.request('createBackup',null);assert.ok(backup.ok);const name=(backup.value as {name:string}).name;
  for(let i=1;i<=31;i++)await cp(join(paths.backups,name),join(paths.backups,`2020-01-01T00-00-00-${String(i).padStart(3,'0')}Z-abcdef01`),{recursive:true});await mkdir(join(paths.backups,'user-files'));await manager.publish(name);const data=await manager.list();assert.equal(data.generations.length,30);assert.ok((await readdir(paths.backups)).includes('user-files'));await service.close();
});
