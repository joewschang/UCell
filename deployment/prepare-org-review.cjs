const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out='C:/UCell/org-review-20261023',built=root+'/backend/apps/api/dist/modules/';
function slice(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return s.slice(i,j)}
function replace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
function read(file){return fs.readFileSync(out+'/live-base/'+path.basename(file),'utf8')}
function save(file,value){for(const dest of [out+'/api',root+'/deployment/releases/org-review-20261023']){const target=dest+'/overlay/modules/'+file;fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value)}}
let file='admin-observability/admin-observability.service.js',base=read(file),source=fs.readFileSync(built+file,'utf8');
save(file,replace(base,slice(base,'    async sponsorTree(','    async qualificationOperations('),slice(source,'    async sponsorTree(','    async qualificationOperations(')));
file='admin-observability/admin-observability.controller.js';base=read(file);save(file,replace(replace(base,'Number(depth ?? 4)','Number(depth ?? 2)'),'Number(depth ?? 5)','Number(depth ?? 2)'));
file='organization-geo/organization-geo.service.js';base=read(file);source=fs.readFileSync(built+file,'utf8');
base=replace(base,slice(base,'    time(input)','    async capture('),slice(source,'    time(input)','    async capture('));
for(const prefix of ['            const descendants =','            const performance =']){const old=base.split('\n').find(l=>l.startsWith(prefix)),next=source.split('\n').find(l=>l.startsWith(prefix));assert(old&&next);base=replace(base,old,next)}
base=replace(base,'const common_1 =','const geo_membership_scope_1 = require("./geo-membership-scope");\nconst common_1 =');save(file,base);
file='binary-tree/binary-tree-metrics.js';base=read(file);base=replace(base,'includeSourceFacts = false) {','includeSourceFacts = false, sourceIds) {');base=replace(base,'const ids = await tx.$queryRaw','const ids = sourceIds ?? await tx.$queryRaw');save(file,base);
save('organization-geo/geo-membership-scope.js',fs.readFileSync(built+'organization-geo/geo-membership-scope.js'));
fs.writeFileSync(out+'/api/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:47556a46776f364c4faf0a0117e8d3997877f62e3f242a45e3efe64a1b781158\nCOPY overlay/ /app/apps/api/dist/\n');
fs.mkdirSync(out+'/admin',{recursive:true});fs.cpSync(root+'/admin/dist',out+'/admin/dist',{recursive:true});
fs.writeFileSync(out+'/admin/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:2de5356cf7f68ddd69f7311b8d93fc8c8e59ee6dd2e45d29a785eb01758816c9\nCOPY dist/ /usr/share/nginx/html/\n');
console.log('Prepared exact-base organization review overlay.');
