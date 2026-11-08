import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {launch} from './launch.mjs';
await mkdir('test-artifacts',{recursive:true});
const root=await mkdtemp(resolve('test-artifacts/document-updates-'));
for(const stage of ['document-updates-create','document-updates-restart'])await new Promise((done,reject)=>{
  const child=launch(['--smoke-test','--phase1-test'],{EW_TEST_DATA_DIR:root,EW_SCENARIO:stage,EW_DEV_URL:''});
  const timer=setTimeout(()=>{child.kill();reject(Error(`${stage} timed out`));},60000);
  child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',code=>{clearTimeout(timer);if(code===0)done();else reject(Error(`${stage} failed (${code})`));});
});
console.log(`DOCUMENT_UPDATES_ALL_PASSED ${root}`);
