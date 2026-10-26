const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out='C:/UCell/placement-ux-20261023',dir=root+'/backend/apps/api/dist/modules/qualification/';
function replace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
function save(name,s){for(const folder of [out+'/api',root+'/deployment/releases/placement-ux-20261023']){const f=folder+'/overlay/modules/qualification/'+name;fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}}
let name='qualification-placement.service.js',base=fs.readFileSync(out+'/live-base/'+name,'utf8'),built=fs.readFileSync(dir+name,'utf8');
const methods=built.slice(built.indexOf('    async branch('),built.indexOf('    async pendingForSponsorOwner('));assert(methods.includes('async dashboard'));
base=replace(base,'const common_1 =',`const placement_workbench_1 = require('./placement-workbench');\nconst current_tree_1 = require('../binary-tree/current-tree');\nconst common_1 =`);
base=replace(base,'    async pendingForSponsorOwner(',methods+'    async pendingForSponsorOwner(');
const guard=built.slice(built.indexOf('                const allocation ='),built.indexOf('                const side = input.side;'));assert(guard.includes('assertCurrentPlacement'));
base=replace(base,'                const side = input.side;',guard+'                const side = input.side;');assert(base.includes('assertQualificationActivation'));save(name,base);
name='qualification-placement.controller.js';base=fs.readFileSync(out+'/live-base/'+name,'utf8');built=fs.readFileSync(dir+name,'utf8');
for(const [method,next,klass] of [['branch','pending','MemberQualificationPlacementController'],['dashboard','returnReviews','AdminQualificationPlacementController']]){
 const start=built.indexOf('    '+method+'('),end=built.indexOf('    '+next+'(',start);assert(start>=0&&end>start);base=replace(base,'    '+next+'(',built.slice(start,end)+'    '+next+'(');
 const tail=klass+'.prototype, "'+method+'", null);',tailIndex=built.indexOf(tail),blockStart=built.lastIndexOf('__decorate([',tailIndex);assert(tailIndex>blockStart);const block=built.slice(blockStart,tailIndex+tail.length);
 const target=base.indexOf(klass+'.prototype, "'+next+'", null);'),insert=base.lastIndexOf('__decorate([',target);assert(insert>0);base=base.slice(0,insert)+block+'\n'+base.slice(insert);
}
save(name,base);save('placement-workbench.js',fs.readFileSync(dir+'placement-workbench.js','utf8'));
fs.writeFileSync(out+'/api/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:3db97ff0978c35de73e6c98313257108c08bc919278ba46ba62cfb4036b5c4ea\nCOPY overlay/ /app/apps/api/dist/\n');
