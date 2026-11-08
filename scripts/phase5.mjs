import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {launch} from './launch.mjs';
await mkdir('test-artifacts',{recursive:true});
const root=await mkdtemp(resolve('test-artifacts/phase5-'));
for(const stage of ['phase5-create','phase5-restart','phase5-crash','phase5-recover','phase5-close-restart']){
  await new Promise((done,reject)=>{
    const child=launch(['--smoke-test','--phase1-test'],{EW_TEST_DATA_DIR:root,EW_SCENARIO:stage,EW_DEV_URL:''});
    const timer=setTimeout(()=>{child.kill();reject(Error(`${stage} timed out`));},90000);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('exit',code=>{clearTimeout(timer);if(code===(stage==='phase5-crash'?17:0))done();else reject(Error(`${stage} failed (${code})`));});
  });
}
console.log(`PHASE5_ALL_PASSED ${root}`);
