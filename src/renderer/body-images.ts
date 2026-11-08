import type { EditorStore } from './editor-store';
import type { ImageRequest, ManagedImage } from '../shared/images';
import { bodyText, itemBody } from '../shared/body';
type Pending = { itemId:string; request:ImageRequest; error:string; working?:Promise<void>; insert?:(image:ManagedImage)=>boolean; store:EditorStore };
const pending=new Set<Pending>(),listeners=new Set<()=>void>();
let snapshot:Pending[]=[];
const emit=()=>{snapshot=[...pending];listeners.forEach(fn=>fn());};
export const bodyImages={subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>snapshot};
async function run(entry:Pending) {
  if(entry.working)return entry.working;
  entry.error='';
  entry.working=(async()=>{
    try {
      const result=await window.workspace.images(entry.request);
      if(!result.ok)throw Error(result.error.message);
      if(result.value){
        if(!entry.insert?.(result.value)) {
          const ref={kind:'item' as const,id:entry.itemId},fields=entry.store.buffer(ref).fields as import('../shared/model').ItemFields;
          const doc=itemBody(fields);doc.content??=[];doc.content.push({type:'image',attrs:{src:result.value.src}});
          entry.store.edit(ref,{body:bodyText(doc),bodyJson:JSON.stringify(doc)});
        }
      }
      pending.delete(entry);
    }catch(error){entry.error=error instanceof Error?error.message:'画像を保存できませんでした。';}
    finally{entry.working=undefined;emit();}
  })();emit();return entry.working;
}
export function addBodyImage(itemId:string,request:ImageRequest,store:EditorStore,insert:(image:ManagedImage)=>boolean){const entry:Pending={itemId,request,store,insert,error:''};pending.add(entry);return run(entry);}
export function retryBodyImages(itemId?:string){return Promise.all([...pending].filter(entry=>!itemId||entry.itemId===itemId).map(run));}
export function discardBodyImages(itemId:string){for(const entry of pending)if(entry.itemId===itemId&&entry.error&&!entry.working)pending.delete(entry);emit();}
export async function flushBodyImages(ids?:Set<string>){await Promise.all([...pending].filter(entry=>!ids||ids.has(entry.itemId)).map(run));const remaining=[...pending].some(entry=>!ids||ids.has(entry.itemId));return {ready:!remaining,draftsSafe:!remaining};}
