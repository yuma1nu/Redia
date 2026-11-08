import type { WorkspaceApi } from '../shared/api';
import { shiftDate } from '../shared/plans.ts';
import { localToday } from '../shared/lists.ts';
import type { PlanDraft,PlanRow,PlanView } from '../shared/plans.ts';
type State={rows:PlanRow[];revision:number;loaded:boolean;loading:boolean;dirty:boolean;safe:boolean;hold:boolean;error?:string;recovery?:PlanDraft;undo:number;redo:number;view:PlanView;viewDirty:boolean;viewError?:string};
export class PlanStore {
  private state:State={rows:[],revision:0,loaded:false,loading:false,dirty:false,safe:true,hold:false,undo:0,redo:0,view:{theme:'all',query:'',selectedId:null,compare:false,scale:'week',from:shiftDate(localToday(),-7),scrollLeft:0,scrollTop:0},viewDirty:false};
  private viewTimer?:ReturnType<typeof setTimeout>;private viewJob?:Promise<boolean>;
  private listeners=new Set<()=>void>();private past:PlanRow[][]=[];private future:PlanRow[][]=[];private generation=0;
  private timer?:ReturnType<typeof setTimeout>;private job?:Promise<boolean>;private loading?:Promise<void>;
  private api:Pick<WorkspaceApi,'plans'>;
  constructor(api:Pick<WorkspaceApi,'plans'>){this.api=api;}
  getSnapshot=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private publish(patch:Partial<State>){this.state={...this.state,...patch,undo:this.past.length,redo:this.future.length};this.listeners.forEach(listener=>listener());}
  load(){if(this.loading)return this.loading;if(this.state.loaded)return Promise.resolve();const viewAtLoad=this.state.view;return this.loading=(async()=>{this.publish({loading:true,error:undefined});try{const result=await this.api.plans({action:'load'});if(!result.ok)throw Error(result.error.message);this.publish({rows:result.value.rows,revision:result.value.revision,recovery:result.value.draft,view:this.state.view===viewAtLoad?result.value.view??this.state.view:this.state.view,loaded:true,loading:false});}catch(error){this.publish({loading:false,error:String(error instanceof Error?error.message:error)});}finally{this.loading=undefined;}})();}
  patchView(patch:Partial<PlanView>){const view={...this.state.view,...patch};if(JSON.stringify(view)===JSON.stringify(this.state.view))return;this.publish({view,viewDirty:true,viewError:undefined});clearTimeout(this.viewTimer);this.viewTimer=setTimeout(()=>void this.flushView(),200);}
  private async flushView():Promise<boolean>{clearTimeout(this.viewTimer);if(this.viewJob){await this.viewJob;return this.flushView();}if(!this.state.viewDirty)return !this.state.viewError;const view=this.state.view;this.viewJob=(async()=>{try{const result=await this.api.plans({action:'view',view});if(!result.ok)throw Error(result.error.message);if(view===this.state.view)this.publish({viewDirty:false,viewError:undefined});return true;}catch(error){this.publish({viewError:error instanceof Error?error.message:'計画の表示条件を保存できませんでした。'});return false;}finally{this.viewJob=undefined;}})();const saved=await this.viewJob;if(saved&&view!==this.state.view)return this.flushView();return saved;}
  change(rows:PlanRow[],hold=false,history=true){
    if(!this.state.loaded||this.state.recovery)return;
    if(JSON.stringify(rows)===JSON.stringify(this.state.rows)){if(this.state.hold!==hold){this.publish({hold});this.schedule();}return;}
    if(history){this.past=[...this.past.slice(-99),this.state.rows];this.future=[];}
    this.generation++;this.publish({rows,dirty:true,safe:false,hold,error:undefined});this.schedule();
  }
  update(id:string,patch:Partial<PlanRow>,hold=false,history=true){this.change(this.state.rows.map(row=>row.id===id?{...row,...patch}:row),hold,history);}
  undo(){let rows;while((rows=this.past.pop())){if(JSON.stringify(rows)===JSON.stringify(this.state.rows))continue;this.future.push(this.state.rows);this.change(rows,false,false);return;}this.publish({});}
  redo(){let rows;while((rows=this.future.pop())){if(JSON.stringify(rows)===JSON.stringify(this.state.rows))continue;this.past.push(this.state.rows);this.change(rows,false,false);return;}this.publish({});}
  private schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>void this.save(),350);}
  save():Promise<boolean>{
    clearTimeout(this.timer);if(this.job)return this.job;if(!this.state.dirty)return Promise.resolve(!this.state.error);
    const generation=this.generation,draft:PlanDraft={rows:this.state.rows,baseRevision:this.state.revision,token:crypto.randomUUID()};
    this.job=(async()=>{
      try{
        const staged=await this.api.plans({action:'stage',draft});if(!staged.ok)throw Error(staged.error.message);
        if(generation===this.generation)this.publish({safe:true});
        if(this.state.hold)return false;
        const committed=await this.api.plans({action:'commit',token:draft.token});if(!committed.ok)throw Error(committed.error.message);
        this.publish({revision:committed.value.revision,...(generation===this.generation?{dirty:false,safe:true,error:undefined}:{})});return generation===this.generation;
      }catch(error){this.publish({error:error instanceof Error?error.message:'計画を保存できませんでした。入力を保持しています。'});return false;}
      finally{this.job=undefined;if(generation!==this.generation)this.schedule();}
    })();return this.job;
  }
  async flush(){
    clearTimeout(this.timer);await this.job;
    for(let attempt=0;attempt<10&&this.state.dirty;attempt++){const generation=this.generation;await this.save();if(generation===this.generation)break;}
    const view=await this.flushView();return {ready:this.state.loaded&&!this.state.dirty&&!this.state.error&&view,draftsSafe:this.state.loaded&&(!this.state.dirty||this.state.safe)&&view};
  }
  restore(){const draft=this.state.recovery;if(!draft)return;this.past=[];this.future=[];this.generation++;this.publish({rows:draft.rows,revision:draft.baseRevision,dirty:true,safe:true,recovery:undefined,error:undefined});this.schedule();}
  async discardRecovery(){const draft=this.state.recovery;if(!draft)return;try{const result=await this.api.plans({action:'discard',token:draft.token});if(!result.ok)throw Error(result.error.message);this.publish({rows:result.value.rows,revision:result.value.revision,recovery:undefined,error:undefined});}catch(error){this.publish({error:error instanceof Error?error.message:'下書きを破棄できませんでした。'});}}
}
export const planStore=new PlanStore(typeof window==='undefined'?{} as WorkspaceApi:window.workspace);
