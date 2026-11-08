import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBodyMenu } from '../src/shared/body-menu.ts';

test('body context menu accepts only bounded formatting state and rejects injected menu commands',()=>{
  const state={readOnly:false,selection:true,heading:2,bold:true,italic:false,bullet:false,ordered:false,task:false,taskItem:false,image:false,link:false,canUndo:true,canRedo:false};
  assert.deepEqual(validateBodyMenu(state),state);
  for(const input of [{...state,role:'quit'},{...state,command:'execute'},{...state,heading:7},{...state,heading:1.5},{...state,bold:'true'},{...state,readOnly:undefined}])assert.throws(()=>validateBodyMenu(input));
});
