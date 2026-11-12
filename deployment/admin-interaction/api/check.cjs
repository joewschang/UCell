const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.env.DIRECTORY_DIST||'/app/apps/api/dist';
if(process.argv[2]==='base'){
  for(const [name,sha] of Object.entries(require('./base-hashes.json')))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),sha);
}else{
  const load=require('node:module').createRequire(path.join(root,'main.js'));
  load('reflect-metadata');
  const {PATH_METADATA,ROUTE_ARGS_METADATA}=load('@nestjs/common/constants');
  const {QualificationController}=load('./modules/qualification/qualification.controller');
  const {OrderController}=load('./modules/order/order.controller');
  const {OrderService}=load('./modules/order/order.service');
  const {QualificationService}=load('./modules/qualification/qualification.service');
  for(const klass of [QualificationController,OrderController]){
    const query=Object.values(Reflect.getMetadata(ROUTE_ARGS_METADATA,klass,'search')||{}).map(m=>m.data);
    assert(query.includes('page')&&query.includes('take'));
  }
  for(const method of ['productOptions','qualificationOptions']){
    assert(Reflect.getMetadata(PATH_METADATA,OrderController.prototype[method]).endsWith('-options'));
    assert.equal(typeof OrderService.prototype[method],'function');
  }
  for(const klass of [OrderService,QualificationService])assert.equal(typeof klass.prototype.search,'function');
  console.log('Verified both paged directories and order option routes');
}
