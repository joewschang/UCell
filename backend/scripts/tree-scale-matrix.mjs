import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const sizes=(process.env.UCELL_SCALE_MATRIX_SIZES??'10000,100000,1000000').split(',').map(Number);
const shapes=(process.env.UCELL_SCALE_MATRIX_SHAPES??'balanced,deep,skewed,wide').split(',');
if(sizes.some(n=>![10000,100000,1000000].includes(n))||shapes.some(s=>!['balanced','deep','skewed','wide'].includes(s)))throw Error('INVALID_SCALE_MATRIX');
const logDir=process.env.UCELL_SCALE_LOG_DIR??path.join(os.tmpdir(),'ucell-scale-matrix');fs.mkdirSync(logDir,{recursive:true});
for(const size of sizes)for(const shape of shapes){
 const file=path.join(logDir,`tree-scale-final-${size}-${shape}.log`),fd=fs.openSync(file,'w');
 console.log('SCALE_CASE_START',size,shape,new Date().toISOString());
 const result=spawnSync(process.execPath,['scripts/api-jest-isolated.mjs','--testRegex','test/tree-scale-populated-http.integration.ts$'],{env:{...process.env,UCELL_SCALE_SEED:'true',UCELL_SCALE_SIZE:String(size),UCELL_SCALE_SHAPE:shape,UCELL_SCALE_SAMPLES:'100'},stdio:['ignore',fd,fd]});fs.closeSync(fd);
 if(result.error||result.status!==0){console.error('SCALE_CASE_FAIL',size,shape,file,result.error?.name??result.status);process.exit(1);}
 console.log('SCALE_CASE_PASS',size,shape,new Date().toISOString());
}
console.log('TREE_SCALE_MATRIX_PASS',sizes.length*shapes.length);
