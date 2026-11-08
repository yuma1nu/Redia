import { existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkspaceDatabase } from './db/workspace.ts';
import { validatePlanDraft,validatePlanView } from '../shared/plans.ts';
import type { PlanResponse,PlanSnapshot } from '../shared/plans.ts';
import { localToday } from '../shared/lists.ts';
import { DomainError,record,uuid } from '../shared/validation.ts';

export class PlanRepository {
  private path:string;
  private database:WorkspaceDatabase;
  constructor(database:WorkspaceDatabase,directory:string){this.database=database;mkdirSync(directory,{recursive:true});this.path=join(directory,'plans.json');}
  snapshot():PlanSnapshot{const raw=this.database.db.prepare('SELECT revision,rows FROM plan_state WHERE id=1').get()!;return {revision:Number(raw.revision),rows:JSON.parse(String(raw.rows))};}
  draft(){return existsSync(this.path)?validatePlanDraft(JSON.parse(readFileSync(this.path,'utf8'))):undefined;}
  private clear(token:string){if(this.draft()?.token===token)unlinkSync(this.path);}
  request(raw:unknown):PlanResponse {
    if(!raw||typeof raw!=='object')throw new DomainError('INVALID_INPUT','計画の入力を確認してください。');
    const action=(raw as {action:unknown}).action;
    if(action==='load'){record(raw,['action']);const draft=this.draft(),view=this.database.db.prepare('SELECT value FROM plan_view WHERE id=1').get();return {...this.snapshot(),draft:draft&&!this.applied(draft.token)?draft:undefined,view:view?validatePlanView(JSON.parse(String(view.value))):undefined};}
    if(action==='view'){const input=record(raw,['action','view']);this.database.db.prepare('INSERT INTO plan_view VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(validatePlanView(input.view)));return this.snapshot();}
    if(action==='stage'){
      const input=record(raw,['action','draft']),draft=validatePlanDraft(input.draft);
      writeFileSync(this.path+'.pending',JSON.stringify(draft),{encoding:'utf8',flush:true});renameSync(this.path+'.pending',this.path);
      return this.snapshot();
    }
    const input=record(raw,['action','token']),token=uuid(input.token);
    if(action==='discard'){this.clear(token);return this.request({action:'load'});}
    if(action!=='commit')throw new DomainError('INVALID_INPUT','未対応の計画操作です。');
    if(this.applied(token))return this.snapshot();
    const stored=this.draft();if(!stored||stored.token!==token)throw new DomainError('CONFLICT','計画の下書きが変わっています。入力を保持しています。');
    const draft=validatePlanDraft(stored,true,localToday()),db=this.database.db;
    db.exec('BEGIN IMMEDIATE');
    try{
      const before=this.snapshot();if(before.revision!==draft.baseRevision)throw new DomainError('CONFLICT','保存済みの計画が変わっています。下書きを保持しています。再読み込みしてください。');
      const themes=new Map(this.database.themes().map(theme=>[theme.id,theme])),items=new Set(this.database.items().map(item=>item.id));
      for(const row of draft.rows){
        if(row.themeId&&!themes.has(row.themeId)||row.itemIds.some(id=>!items.has(id)))throw new DomainError('NOT_FOUND','関連するテーマまたはページが見つかりません。');
      }
      // Archived themes retain their rows, order-independent, without allowing edits/removal.
      for(const row of before.rows.filter(row=>row.themeId&&themes.get(row.themeId)?.archived))if(JSON.stringify(draft.rows.find(next=>next.id===row.id))!==JSON.stringify(row))throw new DomainError('CONFLICT','テーマを復元してから計画を編集してください。');
      for(const row of draft.rows.filter(row=>row.themeId&&themes.get(row.themeId)?.archived))if(!before.rows.some(old=>old.id===row.id))throw new DomainError('CONFLICT','アーカイブしたテーマには追加できません。');
      db.prepare('UPDATE plan_state SET rows=?,revision=revision+1 WHERE id=1').run(JSON.stringify(draft.rows));
      db.prepare('INSERT INTO plan_applied_edits VALUES (?,?)').run(token,before.revision+1);db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    try{this.clear(token);}catch{/* committed tokens suppress stale recovery even if journal cleanup fails */}
    return this.snapshot();
  }
  private applied(token:string){return !!this.database.db.prepare('SELECT 1 FROM plan_applied_edits WHERE token=?').get(token);}
}
