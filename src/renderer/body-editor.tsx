import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { bodyText, imageId, itemBody, safeLink } from '../shared/body';
import type { Item } from '../shared/model';
import type { EditorStore } from './editor-store';
import { addBodyImage, bodyImages, discardBodyImages, retryBodyImages } from './body-images';
import { Modal } from './components';

const ManagedImage=Image.extend({
  parseHTML(){return [{tag:'img[src]',getAttrs:element=>imageId(element.getAttribute('src'))?null:false}];},
  addInputRules(){return [];},
});
export function BodyEditor({item,store,readOnly,split,notify}:{item:Item;store:EditorStore;readOnly:boolean;split:(title:string)=>void;notify:(message:string)=>void}) {
  const current=useRef({item,readOnly,split,notify});current.current={item,readOnly,split,notify};
  const [zoom,setZoom]=useState<string>(),[link,setLink]=useState<string>();
  const [discardingImages,setDiscardingImages]=useState(false);
  const composing=useRef(false),pending=useSyncExternalStore(bodyImages.subscribe,bodyImages.getSnapshot).filter(entry=>entry.itemId===item.id);
  const savedJson=useRef(item.bodyJson),savedText=useRef(item.body);
  const [initialContent]=useState(()=>itemBody(item));
  const menuOpen=useRef(false);
  const editor=useEditor({
    extensions:[StarterKit.configure({heading:{levels:[1,2,3,4,5,6]},blockquote:false,codeBlock:false,horizontalRule:false,strike:false,underline:false,link:{openOnClick:false,autolink:true,isAllowedUri:url=>safeLink(url)}}),TaskList,TaskItem.configure({nested:true}),ManagedImage.configure({allowBase64:false})],
    content:initialContent,editable:!readOnly,injectCSS:false,
    editorProps:{attributes:{id:'item-body',class:'body-editor rich-body',role:'textbox','aria-label':'本文','aria-multiline':'true'},
      handlePaste:(_view,event)=>{
        if(current.current.readOnly)return false;
        const files=[...event.clipboardData?.files??[]].filter(file=>file.type.startsWith('image/'));
        if(!files.length)return false;event.preventDefault();void pasteImages(files).catch(()=>current.current.notify('画像を読み取れませんでした。もう一度貼り付けてください。'));return true;
      },
      handleDrop:(_view,event)=>{if([...event.dataTransfer?.files??[]].length){event.preventDefault();return true;}return false;},
      handleDOMEvents:{
        contextmenu:(view,event)=>{event.preventDefault();const image=(event.target as HTMLElement).closest('img');if(image)editor?.commands.setNodeSelection(view.posAtDOM(image,0));else if(editor?.state.selection.empty){const point=view.posAtCoords({left:event.clientX,top:event.clientY});if(point)editor.commands.setTextSelection(point.pos);}void showMenu();return true;},
        keydown:(_view,event)=>{if((event.key==='F10'&&event.shiftKey)||event.key==='ContextMenu'){event.preventDefault();void showMenu();return true;}return false;},
        click:(view,event)=>{const image=(event.target as HTMLElement).closest('img');if(image){editor?.commands.setNodeSelection(view.posAtDOM(image,0));setZoom(image.src);return true;}const anchor=(event.target as HTMLElement).closest('a');if(anchor){event.preventDefault();if(event.ctrlKey||current.current.readOnly)void openLink(anchor.href);return true;}return false;},
        compositionstart:()=>{composing.current=true;return false;},compositionend:()=>{composing.current=false;const id=current.current.item.id;setTimeout(()=>{if(composing.current)return;if(editor&&!editor.isDestroyed)persist(false);else if(store.getSnapshot().buffers[`item:${id}`]?.hold)store.edit({kind:'item',id},{},false);},30);return false;},
      },
    },
    onUpdate:()=>persist(),
  },[]);
  function persist(hold?:boolean){if(!editor||editor.isDestroyed||current.current.readOnly)return;const json=JSON.stringify(editor.getJSON()),text=bodyText(editor.getJSON() as import('../shared/body').BodyNode);savedJson.current=json;savedText.current=text;store.edit({kind:'item',id:current.current.item.id},{body:text,bodyJson:json},hold??(composing.current||editor.view.composing));}
  useEffect(()=>{editor?.setEditable(!readOnly,false);},[editor,readOnly]);
  useEffect(()=>{
    if(!editor||editor.isDestroyed||composing.current||editor.view.composing)return;
    if(item.bodyJson!==savedJson.current||item.body!==savedText.current){editor.commands.setContent(itemBody(item),{emitUpdate:false});savedJson.current=item.bodyJson;savedText.current=item.body;}
  },[editor,item.bodyJson,item.body]);
  async function pasteImages(files:File[]){for(const file of files){if(file.size>20*1024*1024){current.current.notify('画像は1件20MiB以内で取り込んでください。');continue;}await addBodyImage(current.current.item.id,{action:'import',bytes:new Uint8Array(await file.arrayBuffer())},store,image=>!editor?.isDestroyed&&!!editor?.chain().focus().setImage({src:image.src}).run());}}
  async function openLink(href:string){const result=await window.workspace.images({action:'open-link',href});if(!result.ok)current.current.notify(result.error.message);}
  function taskTitle(){if(!editor)return '';const {$from}=editor.state.selection;for(let depth=$from.depth;depth>0;depth--)if($from.node(depth).type.name==='taskItem')return $from.node(depth).textContent;return '';}
  async function showMenu(){
    if(!editor||editor.isDestroyed||menuOpen.current||composing.current||editor.view.composing)return;
    menuOpen.current=true;
    try {
      const result=await window.workspace.bodyMenu({readOnly:current.current.readOnly,selection:!editor.state.selection.empty,heading:Number(editor.getAttributes('heading').level??0),bold:editor.isActive('bold'),italic:editor.isActive('italic'),bullet:editor.isActive('bulletList'),ordered:editor.isActive('orderedList'),task:editor.isActive('taskList'),taskItem:editor.isActive('taskItem')&&!!taskTitle().trim(),image:editor.isActive('image'),link:editor.isActive('link'),canUndo:editor.can().undo(),canRedo:editor.can().redo()});
      if(!result.ok){current.current.notify(result.error.message);return;}
      if(editor.isDestroyed||!result.value)return;
      const action=result.value;
      if(action==='zoom-image'){setZoom(String(editor.getAttributes('image').src));return;}
      if(action==='open-link'){await openLink(String(editor.getAttributes('link').href??''));return;}
      if(current.current.readOnly)return;
      if(action==='paragraph')editor.chain().focus().clearNodes().setParagraph().run();
      else if(action.startsWith('heading-'))editor.chain().focus().setHeading({level:Number(action.slice(-1)) as 1}).run();
      else if(action==='bold')editor.chain().focus().toggleBold().run();
      else if(action==='italic')editor.chain().focus().toggleItalic().run();
      else if(action==='bullet')editor.chain().focus().toggleBulletList().run();
      else if(action==='ordered')editor.chain().focus().toggleOrderedList().run();
      else if(action==='task')editor.chain().focus().toggleTaskList().run();
      else if(action==='link')setLink(String(editor.getAttributes('link').href??''));
      else if(action==='image')void addBodyImage(current.current.item.id,{action:'pick'},store,image=>!editor.isDestroyed&&editor.chain().focus().setImage({src:image.src}).run());
      else if(action==='delete-image'&&editor.isActive('image'))editor.chain().focus().deleteSelection().run();
      else if(action==='split'&&editor.isActive('taskItem'))current.current.split(taskTitle());
      else if(action==='undo')editor.chain().focus().undo().run();
      else if(action==='redo')editor.chain().focus().redo().run();
    }catch{current.current.notify('本文のメニューを開けませんでした。もう一度お試しください。');}
    finally{menuOpen.current=false;}
  }
  return <section className="body-section rich-body-section">
    <EditorContent editor={editor}/>
    {pending.some(entry=>entry.error)&&<div className="body-image-pending" role="alert"><><span className="error-text">{pending.find(entry=>entry.error)?.error} 未保存の画像があります。</span><button onClick={()=>void retryBodyImages(item.id)}>画像を再試行</button><button onClick={()=>setDiscardingImages(true)}>未保存の画像を破棄</button></></div>}
    {discardingImages&&<Modal title="画像の追加を取り消しますか？" close={()=>setDiscardingImages(false)}><p className="modal-description">保存できていない画像入力を破棄します。保存済みの本文・画像と元ファイルは保持します。</p><div className="modal-footer"><button onClick={()=>setDiscardingImages(false)}>戻る</button><button className="primary-button" onClick={()=>{discardBodyImages(item.id);setDiscardingImages(false);}}>画像入力を破棄</button></div></Modal>}
    {zoom&&<Modal title="画像" className="image-preview-dialog" close={()=>setZoom(undefined)}><img src={zoom} alt="本文画像の拡大表示"/></Modal>}
    {link!==undefined&&<Modal title="リンクを編集" close={()=>setLink(undefined)}><form onSubmit={event=>{event.preventDefault();if(!link){editor?.chain().focus().extendMarkRange('link').unsetLink().run();setLink(undefined);}else if(safeLink(link)){editor?.chain().focus().extendMarkRange('link').setLink({href:link}).run();setLink(undefined);}}}><label className="form-label">URL<input autoFocus aria-label="本文リンクURL" value={link} onChange={event=>setLink(event.target.value)}/></label>{!!link&&!safeLink(link)&&<p className="form-error">http・https・mailtoのリンクを入力してください。</p>}<div className="modal-footer"><button type="button" onClick={()=>setLink(undefined)}>閉じる</button><button className="primary-button" disabled={!!link&&!safeLink(link)}>適用</button></div></form></Modal>}
  </section>;
}
