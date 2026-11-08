import {cp,lstat,mkdir,mkdtemp,readdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {migrations} from './db/migrations.ts';
import {record} from '../shared/validation.ts';
import {parseBody,imageId} from '../shared/body.ts';
import type {BodyNode} from '../shared/body.ts';
export type BackupPaths={database:string;attachments:string;drafts:string;backups:string};
const generation=/^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-[0-9a-f]{8}$/;
const parts=['database','attachments','drafts'] as const;
async function exists(path:string){try{await lstat(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
async function inventory(root:string,prefix=''):Promise<string[]>{const result:string[]=[];for(const entry of await readdir(join(root,prefix),{withFileTypes:true})){const name=prefix?`${prefix}/${entry.name}`:entry.name;if(entry.isSymbolicLink())throw Error('リンクを含むバックアップは扱えません。');if(entry.isDirectory())result.push(...await inventory(root,name));else if(entry.isFile())result.push(name);else throw Error('通常ファイル以外を含みます。');}return result;}
export async function verifyBackup(root:string){
  if((await lstat(root)).isSymbolicLink())throw Error('バックアップのリンクは扱えません。');
  const raw=JSON.parse(await readFile(join(root,'manifest.json'),'utf8')),m=record(raw,['version','createdAt','files']);
  if(m.version!==1||typeof m.createdAt!=='string'||!Number.isFinite(Date.parse(m.createdAt))||!Array.isArray(m.files))throw Error('世代情報が不正です。');
  const seen=new Set<string>();
  for(const rawFile of m.files){const f=record(rawFile,['path','sha256']);if(typeof f.path!=='string'||!(/^workspace\.sqlite(?:-wal|-shm)?$/.test(f.path)||/^(attachments|drafts)\/[A-Za-z0-9_./-]+$/.test(f.path))||f.path.split('/').some(p=>!p||p==='.'||p==='..')||typeof f.sha256!=='string'||!/^[a-f0-9]{64}$/.test(f.sha256)||seen.has(f.path))throw Error('世代内のパスが不正です。');seen.add(f.path);}
  const actual=await inventory(root);if(!seen.has('workspace.sqlite')||actual.length!==seen.size+1||actual.some(path=>path!=='manifest.json'&&!seen.has(path)))throw Error('世代内のファイル構成が一致しません。');
  for(const f of m.files as {path:string;sha256:string}[])if(createHash('sha256').update(await readFile(join(root,f.path))).digest('hex')!==f.sha256)throw Error('バックアップのハッシュが一致しません。');
  if(seen.has('workspace.sqlite-wal')&&(await lstat(join(root,'workspace.sqlite-wal'))).size)throw Error('未確定のWALを含む世代は復元できません。');
  const checkBody=(value:string)=>{const visit=(node:BodyNode)=>{if(node.type==='image'){const id=imageId(node.attrs?.src);if(!id||!seen.has(`attachments/${id}.png`))throw Error('本文画像が不足しています。');}node.content?.forEach(visit);};visit(parseBody(value));};
  const temp=await mkdtemp(join(tmpdir(),'ew-verify-'));try{await cp(join(root,'workspace.sqlite'),join(temp,'check.sqlite'));const db=new DatabaseSync(join(temp,'check.sqlite'));try{
    const version=Number(db.prepare('PRAGMA user_version').get()!.user_version);
    if(db.prepare('PRAGMA integrity_check').get()!.integrity_check!=='ok'||version<1||version>migrations.at(-1)!.version)throw Error('DBが破損しているか、新しいアプリが必要です。');
    db.prepare('SELECT id FROM themes LIMIT 1').all();db.prepare('SELECT id FROM items LIMIT 1').all();
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('DBの参照が不正です。');
    if(version>=5)for(const row of db.prepare('SELECT bodyJson FROM items WHERE bodyJson IS NOT NULL').all())checkBody(String(row.bodyJson));
  }finally{db.close();}}finally{await rm(temp,{recursive:true,force:true});}
  for(const path of seen)if(/^drafts\/[^/]+\.json$/.test(path)){const draft=JSON.parse(await readFile(join(root,path),'utf8'));if(draft?.fields?.bodyJson)checkBody(draft.fields.bodyJson);}
  return {createdAt:m.createdAt};
}
export class BackupManagement{
  private root:string;private config:string;private busy=false;
  readonly paths:BackupPaths;
  constructor(paths:BackupPaths){this.paths=paths;this.root=dirname(dirname(paths.database));this.config=join(this.root,'backup-settings.json');}
  async directory(){if(!await exists(this.config))return this.paths.backups;const c=record(JSON.parse(await readFile(this.config,'utf8')),['directory']);if(typeof c.directory!=='string'||!isAbsolute(c.directory))throw Error('バックアップ設定が不正です。');return c.directory;}
  async setDirectory(directory:string){
    const target=resolve(directory),rel=relative(this.root,target);
    if(!isAbsolute(target)||rel===''||!rel.startsWith('..')&&!isAbsolute(rel)&&target!==resolve(this.paths.backups))throw Error('アプリの管理データ内は保存先にできません。');
    await mkdir(target,{recursive:true});const probe=join(target,`.ew-write-${randomUUID()}`);await writeFile(probe,'',{flag:'wx'});await rm(probe);await writeFile(this.config+'.tmp',JSON.stringify({directory:target}),{flush:true});await rename(this.config+'.tmp',this.config);
  }
  async list(){const directory=await this.directory();await mkdir(directory,{recursive:true});const generations=[];for(const entry of await readdir(directory,{withFileTypes:true})){if(!entry.isDirectory()||!generation.test(entry.name))continue;try{const m=JSON.parse(await readFile(join(directory,entry.name,'manifest.json'),'utf8'));if(m.version===1&&typeof m.createdAt==='string')generations.push({name:entry.name,createdAt:m.createdAt});}catch{/* Partial or damaged generations are never offered as complete. */}}return {directory,generations:generations.sort((a,b)=>b.name.localeCompare(a.name))};}
  async publish(localName:string){if(!generation.test(localName))throw Error('世代名が不正です。');if(this.busy)throw Error('バックアップの処理中です。');this.busy=true;try{const directory=await this.directory();const source=join(this.paths.backups,localName);if(resolve(directory)!==resolve(this.paths.backups)){await mkdir(directory,{recursive:true});const pending=join(directory,localName+'.partial');await cp(source,pending,{recursive:true,errorOnExist:true,force:false});await verifyBackup(pending);await rename(pending,join(directory,localName));}await this.trim(directory);if(resolve(directory)!==resolve(this.paths.backups))await this.trim(this.paths.backups);return {name:localName,createdAt:(await verifyBackup(join(directory,localName))).createdAt};}finally{this.busy=false;}}
  private async trim(directory:string){const names=(await readdir(directory,{withFileTypes:true})).filter(e=>e.isDirectory()&&generation.test(e.name)).map(e=>e.name).sort().reverse();for(const name of names.slice(30)){await verifyBackup(join(directory,name));await rm(join(directory,name),{recursive:true});}}
  async prepare(name:string){
    if(!generation.test(name))throw Error('世代名が不正です。');const source=join(await this.directory(),name);await verifyBackup(source);
    const staging=join(this.root,'restore-pending');if(await exists(staging))throw Error('復元の準備が残っています。アプリを再起動してください。');await mkdir(staging);
    try{await cp(source,join(staging,'snapshot'),{recursive:true});await verifyBackup(join(staging,'snapshot'));await mkdir(join(staging,'incoming'));await mkdir(join(staging,'incoming','database'));await cp(join(staging,'snapshot','workspace.sqlite'),join(staging,'incoming','database','workspace.sqlite'));for(const part of ['attachments','drafts'])await cp(join(staging,'snapshot',part),join(staging,'incoming',part),{recursive:true});await writeFile(join(staging,'ready.json'),JSON.stringify({version:1}),{flush:true});}catch(error){await rm(staging,{recursive:true,force:true});throw error;}
  }
}
// Only run before opening SQLite. Interrupted installs always roll back first.
export async function applyPendingRestore(paths:BackupPaths,failAfter=-1){
  const root=dirname(dirname(paths.database)),pending=join(root,'restore-pending');if(!await exists(pending))return;
  const journal=join(pending,'install.json'),old=join(pending,'old');
  async function rollback(){for(const part of parts){const backup=join(old,part),target=join(root,part);if(await exists(backup)){await rm(target,{recursive:true,force:true});await rename(backup,target);}}}
  if(await exists(journal)){await rollback();await rm(pending,{recursive:true});return;}
  if(!await exists(join(pending,'ready.json'))){await rm(pending,{recursive:true});return;}
  await verifyBackup(join(pending,'snapshot'));
  await rm(join(pending,'incoming'),{recursive:true,force:true});await mkdir(join(pending,'incoming','database'),{recursive:true});await cp(join(pending,'snapshot','workspace.sqlite'),join(pending,'incoming','database','workspace.sqlite'));for(const part of ['attachments','drafts'])await cp(join(pending,'snapshot',part),join(pending,'incoming',part),{recursive:true});
  await mkdir(old);await writeFile(journal,'installing',{flush:true});
  try{for(const [index,part] of parts.entries()){const target=join(root,part);if(await exists(target))await rename(target,join(old,part));await rename(join(pending,'incoming',part),target);if(index===failAfter)throw Error('Injected restore failure');}
    // Keep the pre-restore files separately; they never appear as a completed backup.
    await rename(old,join(root,`before-restore-${Date.now()}-${randomUUID().slice(0,8)}`));await rm(pending,{recursive:true});
  }catch(error){await rollback();await rm(pending,{recursive:true});throw error;}
}
