const fs=require('node:fs'),path=require('node:path'),root=process.argv[2]||'/app/apps/api/dist/modules';
function edit(file,changes){const dest=path.join(root,file);let s=fs.readFileSync(dest,'utf8');for(const [a,b] of changes){if(s.split(a).length!==2)throw Error(file+': '+a);s=s.replace(a,()=>b);}new Function(s);fs.writeFileSync(dest,s);}
const scope='require("./member-scope.cjs")';
edit('person/member-directory.js',[['NOT: [representativeOnly(now), withdrawnPaperDraft]','NOT: [representativeOnly(now), withdrawnPaperDraft,'+scope+'.NOT]']]);
edit('person/person-maintenance.controller.js',[['const row = await tx.person.findUnique({ where: { personId: id } });','const row = await tx.person.findFirst({ where: { personId: id, ...'+scope+' } });']]);
edit('person/person.service.js',[
 ['const row = await this.prisma.person.findUniqueOrThrow({ where: { personId } });','const row = await this.prisma.person.findFirstOrThrow({ where: { personId,...'+scope+' } });'],
 ['where: { ...(activeOnly ?','where: { ...'+scope+', ...(activeOnly ?']
]);
const cls='AdminAuthController',prototype=cls+'.prototype',marker='exports.AdminAuthController = AdminAuthController;';
let install='';
for(const [method,verb] of [['list','Get'],['change','Post']]){
 install+=`\n${prototype}.staff_${method}=function(req,body){return require("./staff.cjs").${method}(this.service,req,body)};\n__decorate([(0,common_1.${verb})('staff-accounts'),(0,common_1.UseGuards)(authentication_guard_1.AuthenticationGuard),__param(0,(0,common_1.Req)()),${method==='change'?'__param(1,(0,common_1.Body)()),':''}__metadata("design:paramtypes",${method==='change'?'[Object,Object]':'[Object]'})],${prototype},"staff_${method}",null);`;
}
edit('auth/admin-auth.controller.js',[[marker,marker+install]]);
