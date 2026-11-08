import { invalid, record } from './validation.ts';

export type BodyMenuCommand = 'paragraph' | `heading-${1|2|3|4|5|6}` | 'bold' | 'italic' | 'bullet' | 'ordered' | 'task' | 'link' | 'open-link' | 'image' | 'zoom-image' | 'delete-image' | 'split' | 'undo' | 'redo';
export type BodyMenuState = {
  readOnly:boolean; selection:boolean; heading:number; bold:boolean; italic:boolean; bullet:boolean; ordered:boolean; task:boolean;
  taskItem:boolean; image:boolean; link:boolean; canUndo:boolean; canRedo:boolean;
};
export function validateBodyMenu(input:unknown):BodyMenuState {
  const flags=['readOnly','selection','bold','italic','bullet','ordered','task','taskItem','image','link','canUndo','canRedo'];
  const state=record(input,[...flags,'heading']);
  if(flags.some(key=>typeof state[key]!=='boolean')||!Number.isInteger(state.heading)||Number(state.heading)<0||Number(state.heading)>6)invalid();
  return state as BodyMenuState;
}
