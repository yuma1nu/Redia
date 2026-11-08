import type { Result } from '../shared/model';
import type { SearchRequest, SearchResponse } from '../shared/search';
type State={query:string;includeArchived:boolean;loading:boolean;error:string;data:SearchResponse};
export class SearchStore {
  private state:State={query:'',includeArchived:false,loading:true,error:'',data:{results:[],total:0}};
  private generation=0;
  private timer?:ReturnType<typeof setTimeout>;
  private listeners=new Set<()=>void>();
  private send:(request:SearchRequest)=>Promise<Result<SearchResponse|null>>;
  constructor(send:(request:SearchRequest)=>Promise<Result<SearchResponse|null>>){this.send=send;}
  getSnapshot=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private emit(patch:Partial<State>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
  change(patch:Partial<Pick<State,'query'|'includeArchived'>>){this.cancel();this.emit({...patch,loading:true,error:''});this.timer=setTimeout(()=>void this.load(),150);}
  async load(){clearTimeout(this.timer);const generation=++this.generation;this.emit({loading:true,error:''});try{const result=await this.send({action:'query',query:this.state.query,includeArchived:this.state.includeArchived});if(generation!==this.generation)return;if(!result.ok)throw Error(result.error.message);this.emit({data:result.value??{results:[],total:0},loading:false});}catch(error){if(generation===this.generation)this.emit({loading:false,error:error instanceof Error?error.message:'検索できませんでした。'});}}
  cancel(){clearTimeout(this.timer);this.generation++;}
}
