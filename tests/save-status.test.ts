import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveStatus} from '../src/shared/save-status.ts';
test('only failed saves show feedback, including during loading or concurrent writes',()=>{
  assert.deepEqual(saveStatus({error:'資料の保存に失敗しました',saving:true}),{label:'資料の保存に失敗しました',icon:'alert',error:true});
  for(const input of [{},{saving:true},{draft:true},{loading:true}])assert.equal(saveStatus(input).label,'');
  assert.deepEqual(saveStatus({loading:true,error:'読込失敗'}),{label:'読込失敗',icon:'alert',error:true});
});
