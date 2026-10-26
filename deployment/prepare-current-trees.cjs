const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out='C:/UCell/current-trees-20261023';
const built=root+'/backend/apps/api/dist/modules/binary-tree/';
function slice(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return s.slice(i,j)}
function insert(s,anchor,value){assert.equal(s.split(anchor).length,2,anchor);return s.replace(anchor,value+anchor)}
function save(name,value){for(const dest of [out+'/api',root+'/deployment/releases/current-trees-20261023']){const file=dest+'/overlay/modules/binary-tree/'+name;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value)}}
let name='binary-tree-read.service.js',base=fs.readFileSync(out+'/live-base/'+name,'utf8'),source=fs.readFileSync(built+name,'utf8');
const methods=slice(source,'    async currentList(','    time(raw)');
save(name,insert(insert(base,'    time(raw)',methods),'const tree_active_evidence_1', 'const current_tree_1 = require("./current-tree");\n'));
name='binary-tree-read.controller.js';base=fs.readFileSync(out+'/live-base/'+name,'utf8');source=fs.readFileSync(built+name,'utf8');
const dto=slice(source,'class CurrentTreeQuery','class TreeTimeQuery');
const currentMethods=slice(source,'    async currentList(','    async list(');
const decorators=slice(source,"__decorate([\n    (0, common_1.Get)('current')",'__decorate([\n    (0, common_1.Get)()');
save(name,insert(insert(insert(base,'class TreeTimeQuery',dto),'    async list(',currentMethods),'__decorate([\n    (0, common_1.Get)()',decorators));
name='binary-tree.service.js';base=fs.readFileSync(out+'/live-base/'+name,'utf8');
const slot='            await this.organization.assertBinarySlotAvailable(tx, input.binaryParentQualificationId, input.side);';
assert.equal(base.split(slot).length,3);
const guard='            await (0, current_tree_1.assertCurrentPlacement)(tx, treeId, input.qualificationId, input.binaryParentQualificationId);\n';
let patched=base.split(slot).join(guard+slot);patched=insert(patched,'const common_1', 'const current_tree_1 = require("./current-tree");\n');
assert(patched.includes('qualification_activation_gate_1.assertQualificationActivation'));assert.equal(patched.replace('const current_tree_1 = require("./current-tree");\n','').split(guard).join(''),base);
save(name,patched);save('current-tree.js',fs.readFileSync(built+'current-tree.js'));
fs.writeFileSync(out+'/api/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:0beffc1b3054c0fd55159e2b105cb2a189f032b1f09beb729a790a4154b054e6\nCOPY overlay/ /app/apps/api/dist/\n');
fs.mkdirSync(out+'/admin',{recursive:true});fs.cpSync(root+'/admin/dist',out+'/admin/dist',{recursive:true});
fs.writeFileSync(out+'/admin/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:4c52cb7fb0c3bb1f05471753f0b7cd442f484b4bebcf1c16134b15d3ed2cff5f\nCOPY dist/ /usr/share/nginx/html/\n');
console.log('Prepared exact-base API overlay and production admin bundle.');
