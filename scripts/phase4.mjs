import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {launch} from './launch.mjs';
await mkdir('test-artifacts',{recursive:true});
const root=await mkdtemp(resolve('test-artifacts/phase4-'));
for(const stage of ['phase4-create','phase4-restart','phase4-crash','phase4-recover','phase4-close-restart','phase4-body-menu','phase4-performance']){
  await new Promise((done,reject)=>{
    const child=launch(['--smoke-test','--phase1-test'],{EW_TEST_DATA_DIR:root,EW_SCENARIO:stage,EW_DEV_URL:''});
    const timer=setTimeout(()=>{child.kill();reject(Error(`${stage} timed out`));},90000);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('exit',code=>{clearTimeout(timer);if(code===(stage==='phase4-crash'?17:0))done();else reject(Error(`${stage} failed (${code})`));});
  });
}
console.log(`PHASE4_ALL_PASSED ${root}`);
