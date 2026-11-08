import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {launch} from './launch.mjs';
await mkdir('test-artifacts',{recursive:true});
const root=await mkdtemp(resolve('test-artifacts/focus-'));
await new Promise((done,reject)=>{
  const child=launch(['--smoke-test','--phase1-test'],{EW_TEST_DATA_DIR:root,EW_SCENARIO:'modal-focus',EW_DEV_URL:''});
  const timer=setTimeout(()=>{child.kill();reject(Error('Modal focus test timed out'));},60000);
  child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',code=>{clearTimeout(timer);if(code===0)done();else reject(Error(`Modal focus failed (${code})`));});
});
console.log(`MODAL_FOCUS_ALL_PASSED ${root}`);
