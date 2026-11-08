import { Menu } from 'electron';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { validateBodyMenu } from '../shared/body-menu';
import type { BodyMenuCommand, BodyMenuState } from '../shared/body-menu';
import type { Result } from '../shared/model';

export function buildBodyMenu(state:BodyMenuState,choose:(action:BodyMenuCommand)=>void) {
  const command=(id:BodyMenuCommand,label:string,options:Partial<MenuItemConstructorOptions>={}):MenuItemConstructorOptions=>({id,label,click:()=>choose(id),registerAccelerator:false,...options});
  const items:MenuItemConstructorOptions[]=[];
  if(!state.readOnly)items.push(command('undo','元に戻す',{enabled:state.canUndo,accelerator:'Ctrl+Z'}),command('redo','やり直す',{enabled:state.canRedo,accelerator:'Ctrl+Shift+Z'}),{type:'separator'});
  if(!state.readOnly)items.push({role:'cut',label:'切り取り',enabled:state.selection});
  items.push({role:'copy',label:'コピー',enabled:state.selection});
  if(!state.readOnly)items.push({role:'paste',label:'貼り付け'});
  items.push({role:'selectAll',label:'すべて選択'});
  if(!state.readOnly){
    items.push({type:'separator'},{label:'段落',submenu:[command('paragraph','標準',{type:'radio',checked:state.heading===0&&!state.bullet&&!state.ordered&&!state.task}),...[1,2,3,4,5,6].map(level=>command(`heading-${level}` as BodyMenuCommand,`見出し ${level}`,{type:'radio',checked:state.heading===level}))]},
      command('bold','太字',{type:'checkbox',checked:state.bold,accelerator:'Ctrl+B'}),command('italic','斜体',{type:'checkbox',checked:state.italic,accelerator:'Ctrl+I'}),
      command('bullet','箇条書き',{type:'checkbox',checked:state.bullet}),command('ordered','番号付きリスト',{type:'checkbox',checked:state.ordered}),command('task','チェックリスト',{type:'checkbox',checked:state.task}),
      {type:'separator'},command('link','リンクを編集'),command('image','画像を追加'));
    if(state.taskItem)items.push(command('split','ページにする'));
  }
  if(state.link)items.push(command('open-link','リンクを開く'));
  if(state.image){items.push({type:'separator'},command('zoom-image','画像を拡大'));if(!state.readOnly)items.push(command('delete-image','本文から画像を削除'));}
  return Menu.buildFromTemplate(items);
}
export async function popupBodyMenu(window:BrowserWindow,input:unknown):Promise<Result<BodyMenuCommand|null>> {
  try {
    const state=validateBodyMenu(input);
    return await new Promise(resolve=>{
      let selected:BodyMenuCommand|null=null;
      const menu=buildBodyMenu(state,action=>{selected=action;});
      let done=false;
      const finish=()=>{if(done)return;done=true;window.removeListener('closed',finish);resolve({ok:true,value:selected});};
      window.once('closed',finish);
      menu.popup({window,callback:()=>setTimeout(finish,0)});
    });
  }catch{return {ok:false,error:{code:'INVALID_INPUT',message:'本文のメニューを開けませんでした。もう一度お試しください。'}};}
}
