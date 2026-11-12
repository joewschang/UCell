'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const repo=path.resolve(__dirname,'../../..'),api=path.join(repo,'backend/apps/api');
const ts=require(require.resolve('typescript',{paths:[api]}));
const options={target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true};
const inputs={
  'qualification/qualification.controller':'c2726dc64efeb73c5fb15ca17b28b239902b8b91bb18c177304cf903f8d9ed9d',
  'qualification/qualification.service':'1dac2cf236af4410775e90a89255f3b49cc9405d96642c3a2ac91c4652706f69',
  'order/order.controller':'a85f798bdc43e5563829ee2a940859802717f3d0785c2fc55218a201cad8d72a',
  'order/order.service':'eb37e6cc5e1d98de68312c2050ed46ff51d45cac0129654e1e87e5f55677a381'
};
function compile(rel){return ts.transpileModule(fs.readFileSync(path.join(api,'src',rel+'.ts'),'utf8'),{compilerOptions:options}).outputText.replace(/\r/g,'');}
function once(s,anchor,to){assert.equal(s.split(anchor).length,2,'Missing unique anchor '+anchor);return s.replace(anchor,()=>to);}
function slice(s,from,to){const i=s.indexOf(from),j=s.indexOf(to,i+from.length);assert(i>=0&&j>i,from);return s.slice(i,j);}
function prepare(root,out) {
  const dist=path.join(out,'dist'),compiled={};
  function save(rel,value){const f=path.join(dist,rel+'.js');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,value);}
  for(const rel of ['common/utils/directory-page','modules/qualification/qualification-directory'])save(rel,compile(rel));
  for(const [name,sha] of Object.entries(inputs)){
    const rel='modules/'+name,buf=fs.readFileSync(path.join(root,rel+'.js'));
    assert.equal(createHash('sha256').update(buf).digest('hex'),sha,name);
    let original=buf.toString('utf8').replace(/\r/g,'');
    const source=compile(rel),isOrder=name.startsWith('order/'),klass=isOrder?'OrderController':'QualificationController';
    if(name.endsWith('controller')){
      const common=isOrder?'common_1':'common_2';
      original=once(original,'"use strict";','"use strict";\nconst directory_page_1=require("../../common/utils/directory-page");');
      const old=slice(original,'    async search(', '    async create(');
      let next=old.replace('take) {','take, page) {').replace('archived) {','archived, page) {');
      next=once(next,'return { data: await this.service.search({','const window = (0, directory_page_1.directoryPage)(page,take);\n        const rows = await this.service.search({');
      next=once(next,'}) };','},window);\n        return (0,directory_page_1.directoryResult)(rows,window);');
      if(isOrder)next+=slice(source,'    async qualificationOptions(', '    async create(');
      original=once(original,old,next);
      const marker='__decorate([\n    (0, '+common+'.Get)(),\n    (0, swagger_1.ApiOperation)({ operationId:';
      const decor=slice(original,marker,'], '+klass+'.prototype, "search", null);')+'], '+klass+'.prototype, "search", null);';
      let newDecor=once(decor,'    __metadata("design:type", Function),','    __param('+ (isOrder?5:3)+', (0,'+common+'.Query)(\'page\')),\n    __metadata("design:type", Function),');
      newDecor=newDecor.replace(/__metadata\("design:paramtypes", \[([\w, ]+)\]\)/,'__metadata("design:paramtypes", [$1, String])');
      if(isOrder){
        newDecor+='\n'+slice(source,'__decorate([\n    (0, common_1.Get)(\'qualification-options\')','__decorate([\n    (0, common_1.Post)()');
        original=once(original,'    (0, common_1.Post)(),','    (0, common_1.Post)(),\n    (0, roles_decorator_1.Roles)(\'SUPER_ADMIN\', \'ORDER_OPS\', \'FINANCE\'),');
      }
      original=once(original,decor,newDecor);
    }else if(!isOrder){
      original=once(original,'"use strict";','"use strict";\nconst qualification_directory_1=require("./qualification-directory");');
      original=once(original,slice(original,'    async search(input','    async get(qualificationId'),slice(source,'    async search(input','    async get(qualificationId'));
    }else{
      original=once(original,'"use strict";','"use strict";\nconst qualification_directory_1=require("../qualification/qualification-directory");');
      const prev=slice(original,'    async search(input','    async get(orderId');
      const revision=slice(source,'    qualificationOptions(', '    async search(input')+once(once(prev,'async search(input = {})','async search(input = {}, window)'),"orderBy: { createdAt: 'desc' },\n            take,","orderBy: [{createdAt:'desc'},{orderId:'desc'}],\n            skip:window?.skip,\n            take:window?window.take+1:take,");
      original=once(original,prev,revision);
      const create=slice(original,'    async create(dto, key, requestId, actorId, member = false)', '        const offering = await this.resolveOfferingSnapshot');
      const reference=slice(source,'    async create(dto, key, requestId, actorId, member = false)', '        const offering = await this.resolveOfferingSnapshot');
      const quantity=slice(reference,'            if (!member && dto.items.some','            const productIds =');
      const currency=slice(reference,'            if (!member && products.some','            const now = new Date();');
      original=once(original,create,once(once(create,'            const productIds =',quantity+'            const productIds ='),
        '            const now = new Date();',currency+'            const now = new Date();'));
    }
    save(rel,original);compiled[rel+'.js']=sha;
  }
  fs.writeFileSync(path.join(out,'base-hashes.json'),JSON.stringify(compiled));
  fs.copyFileSync(path.join(__dirname,'Dockerfile'),path.join(out,'Dockerfile'));
  fs.copyFileSync(path.join(__dirname,'check.cjs'),path.join(out,'check.cjs'));
}
if(require.main===module)prepare(process.argv[2],process.argv[3]);
