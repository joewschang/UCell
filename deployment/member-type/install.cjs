'use strict';
const nest=require('@nestjs/common');
const {PiiCryptoService}=require('@ucell/database');
const {profile,maintain,uuid}=require('./profile.cjs');
const {convert}=require('./convert.cjs');
module.exports=function install(Controller){
 const proto=Controller.prototype;
 proto.onModuleInit=async function(){await require('./migration.cjs').migrate(this.db);};
 function route(name,path,method,args,fn){
 Object.defineProperty(proto,name,{value:fn,configurable:true});
 args.forEach((d,i)=>d(proto,name,i));
 const descriptor=Object.getOwnPropertyDescriptor(proto,name);
 method(path)(proto,name,descriptor);nest.Header('Cache-Control','private, no-store')(proto,name,descriptor);
 }
 const root='member-type/:type/:id',params=[nest.Param('type'),nest.Param('id')];
 route('memberTypeView',root,nest.Get,params,async function(type,id){return {data:await profile(this.db,type,id)};});
 route('memberTypeSave',root,nest.Post,[...params,nest.Body(),nest.Req()],async function(type,id,b,r){
 if(!b)throw new nest.BadRequestException('缺少異動資料');
 const result=type==='LEGAL_ENTITY'&&b.nextType===type?await maintain(this.db,id,b,r.user.personId):await convert(this.db,type,id,b,r.user.personId);
 return {data:result};
 });
 route('memberTypeProof',root+'/proof/:doc',nest.Get,[...params,nest.Param('doc'),nest.Req()],async function(type,id,doc,r){
 if(type!=='LEGAL_ENTITY'||!uuid.test(id)||!uuid.test(doc))throw new nest.NotFoundException();
 const [e]=await this.db.$queryRaw`SELECT mime,ciphertext,key_version FROM identity.member_type_evidence WHERE evidence_id=${doc}::uuid AND legal_entity_id=${id}::uuid`;
 if(!e)throw new nest.NotFoundException();
 const content=new PiiCryptoService().decrypt(e.ciphertext,e.key_version);
 return new nest.StreamableFile(Buffer.from(content,'base64'),{type:e.mime,disposition:'attachment; filename="registration.'+({'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[e.mime])+'"'});
 });
};
