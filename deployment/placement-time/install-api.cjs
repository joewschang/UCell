'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const sha = data => createHash('sha256').update(data).digest('hex');

function patchWorkbench(original) {
  assert.equal(sha(original),'93aa581e87a887471ee2a602896e274927311f41adef13c40470651e166be788','Unexpected placement-workbench.js');
  const start = original.indexOf('async function placementMonitor(db, input = {}, now = new Date()) {');
  const end = original.lastIndexOf('//# sourceMappingURL');
  assert(start>0 && end>start);
  return original.slice(0,start)+'function placementMonitor(db, input, now) { return require("./placement-monitor").placementMonitor(db, input, now); }\n'+original.slice(end);
}

function patchTree(original) {
  assert.equal(sha(original),'5658e7159d8a783b626b5136f9ffcf29db424c484ab4da0b62b8842a2f1dc68a','Unexpected current-tree.js');
  const start = original.indexOf('const pending = await tx.qualification.findMany({ where: { ...pendingWhere');
  const end = original.indexOf('const pendingTotal = await tx.qualification.count({ where: pendingWhere });',start);
  assert(start>0 && end>start);
  let patched = original.slice(0,start)
    +'const {pending,pendingTotal}=await require("../qualification/placement-time-page").treePlacementPage(tx,pendingWhere,input.after);'
    +original.slice(original.indexOf(';',end)+1);
  const name = 'const mapPending = (q) => ({ qualificationId: q.qualificationId,';
  assert.equal(patched.split(name).length,2);
  return patched.replace(name,name+' requestedAt:q.requestedAt,');
}

function install(dist,release){
  const q=path.join(dist,'modules/qualification');
  const workbench=path.join(q,'placement-workbench.js'), tree=path.join(dist,'modules/binary-tree/current-tree.js');
  const updatedWorkbench=patchWorkbench(fs.readFileSync(workbench,'utf8')), updatedTree=patchTree(fs.readFileSync(tree,'utf8'));
  for(const name of ['placement-monitor.js','placement-time-page.js'])fs.copyFileSync(path.join(release,name),path.join(q,name));
  fs.writeFileSync(workbench,updatedWorkbench);fs.writeFileSync(tree,updatedTree);
}
module.exports={patchWorkbench,patchTree,install};
if(require.main===module)install('/app/apps/api/dist',__dirname);
