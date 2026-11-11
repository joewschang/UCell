const fs=require("node:fs"),path=require("node:path"),{createRequire}=require("node:module");
const dir="/app/apps/api/dist/modules/member";
const ts=createRequire(path.join(dir,"formal-member-application.service.js"))("typescript");
const src=fs.readFileSync(path.join(__dirname,"formal-review-directory.ts"),"utf8");
fs.writeFileSync(path.join(dir,"formal-review-directory.js"),ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
function update(file,edits) {
  const dest=path.join(dir,file);
  let s=fs.readFileSync(dest,"utf8");
  for(const [from,to] of edits){
    if(s.split(from).length!==2)throw Error("Formal directory anchor drift: "+from);
    s=s.replace(from,()=>to);
  }
  fs.writeFileSync(dest,s);
}
update("formal-member-application.service.js",[["async adminList(input = {}) {",
  'directory(input) { return require("./formal-review-directory").formalReviewDirectory(this.db,input); }\n    async adminList(input = {}) {']]);
update("admin-formal-member-application.controller.js",[
 ["list(status, take, sourceChannel) { return this.service.adminList(", 'list(status, take, sourceChannel, page, q) { if(page!==undefined||q!==undefined)return this.service.directory({page:page??"1",take,status,sourceChannel,q}); return this.service.adminList('],
 ["__param(0, (0, common_2.Query)('status')),\n    __param(1, (0, common_2.Query)('take')),\n    __param(2, (0, common_2.Query)('sourceChannel')),",
  "(0, common_2.Header)('Cache-Control','private, no-store'),\n    __param(0, (0, common_2.Query)('status')),\n    __param(1, (0, common_2.Query)('take')),\n    __param(2, (0, common_2.Query)('sourceChannel')),\n    __param(3, (0, common_2.Query)('page')),\n    __param(4, (0, common_2.Query)('q')),"],
 ['[String, String, String]),\n    __metadata("design:returntype", void 0)\n], AdminFormalMemberApplicationController.prototype, "list", null);',
  '[String, String, String, String, String]),\n    __metadata("design:returntype", void 0)\n], AdminFormalMemberApplicationController.prototype, "list", null);']
]);
