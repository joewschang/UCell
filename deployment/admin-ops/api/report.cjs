const fs = require('node:fs');
const path = require('node:path');
function applyReport(file,method) {
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  const controller=path.join(path.dirname(file),'admin-ops-ready.controller.js');
  function pinned(p,expected) {
    const data=fs.readFileSync(p);
    if(crypto.createHash('sha256').update(data).digest('hex')!==expected) throw Error('Unexpected admin report module '+path.basename(p));
    return data.toString('utf8');
  }
  let service=pinned(file,'c5e215282c128d645a979464642648f3b9c70308955bbab023ae6fb84ea4d01d');
  let ctrl=pinned(controller,'9f0c62fcc13afcf3074563aa55b72b836570416ebaecffb9bdaa0a7d5ff92408');
  function replaceOnce(input,before,after) {
    if(input.split(before).length!==2)throw Error('Missing report anchor: '+before);
    return input.replace(before,()=>after);
  }
  const begin=service.indexOf('    async operationsReport('),end=service.indexOf('    async integrityAlerts()',begin);
  if(begin<0 || end===-1)throw Error('Missing report method');
  service=service.slice(0,begin)+method+service.slice(end);
  service=replaceOnce(service,'async exportDataset(dataset, take = 5000, from, to)','async exportDataset(dataset, take = 5000, from, to, endExclusive = false)');
  service=replaceOnce(service,'const period = from && to ? { gte: from, lte: to } : undefined','const period = from && to ? (endExclusive ? {gte:from,lt:to} : {gte:from,lte:to}) : undefined');
  ctrl=replaceOnce(ctrl,'report(from, to) {','report(from, to, endExclusive) {');
  ctrl=replaceOnce(ctrl,'new Date(from), new Date(to)).then','new Date(from), new Date(to), endExclusive === "true").then');
  ctrl=replaceOnce(ctrl,'export(dataset, take, from, to) {','export(dataset, take, from, to, endExclusive) {');
  ctrl=replaceOnce(ctrl,'to === undefined ? undefined : new Date(to)).then','to === undefined ? undefined : new Date(to), endExclusive === "true").then');
  for(const n of [1,3]){
    const anchor="__param("+n+", (0, common_1.Query)('to')),";
    const args=Array(n+1).fill('String').join(', ');
    ctrl=replaceOnce(ctrl,anchor+'\n    __metadata("design:type", Function),\n    __metadata("design:paramtypes", ['+args+'])',
      anchor+'\n    (0, swagger_1.ApiQuery)({name:"endExclusive",required:false}),\n    __param('+(n+1)+', (0, common_1.Query)("endExclusive")),\n    __metadata("design:type", Function),\n    __metadata("design:paramtypes", ['+args+', String])');
  }
  fs.writeFileSync(file,service);
  fs.writeFileSync(controller,ctrl);
}
if(process.argv[2]!=='--prepare')throw Error('Prepare the API overlay with --prepare <output file>');
const admin=path.resolve(__dirname,'../../../admin');
const ts=require(require.resolve('typescript',{paths:[admin]}));
const source=fs.readFileSync(path.resolve(__dirname,'../../../backend/apps/api/src/modules/admin-ops-ready/admin-ops-ready.service.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const begin=compiled.indexOf('    async operationsReport('),end=compiled.indexOf('    async integrityAlerts()',begin);
if(begin<0||end===-1||!compiled.slice(begin,end).includes('paidOrdersByCurrency'))throw Error('Report source missing');
fs.writeFileSync(process.argv[3],'('+applyReport.toString()+')(process.argv[2],'+JSON.stringify(compiled.slice(begin,end))+');\n');
