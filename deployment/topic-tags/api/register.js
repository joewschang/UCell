'use strict';
const nest=require('@nestjs/common');
const topics=require('./topics');
const ai=require('./topic-ai');
module.exports=function install({HealthGameService,AdminHealthGame,MemberHealthGame,PublicHealthGame}){
 require('./health-tags').installLegacy(HealthGameService);
 const original=HealthGameService.prototype.onModuleInit;
 HealthGameService.prototype.onModuleInit=async function(){
 await original.call(this);
 await ai.setup(this);
 let active=false;
 this.topicTimer=setInterval(async()=>{if(active)return;active=true;try{await ai.tick(this);}catch(e){console.warn('Topic suggestion scan:',e.message);}finally{active=false;}},60000);
 this.topicTimer.unref();
 };
 HealthGameService.prototype.onModuleDestroy=function(){clearInterval(this.topicTimer);};
 function route(cls,key,method,path,parameters,fn){
 Object.defineProperty(cls.prototype,key,{value:fn,configurable:true});
 parameters.forEach((p,i)=>p()(cls.prototype,key,i));
 method(path)(cls.prototype,key,Object.getOwnPropertyDescriptor(cls.prototype,key));
 }
 route(PublicHealthGame,'topics',nest.Get,'topics',[],function(){return topics.view(this.service,null,false);});
 route(MemberHealthGame,'topics',nest.Get,'topics',[nest.Req],function(r){return topics.view(this.service,r.user.personId,false);});
 route(AdminHealthGame,'topics',nest.Get,'topics',[],async function(){
 const result=await topics.view(this.service,null,true);
 for(const j of result.jobs)if(j.proposal)j.key=topics.hash(j.proposal);
 return result;
 });
 route(AdminHealthGame,'editTopics',nest.Post,'topics',[nest.Body,nest.Req],function(b,r){return topics.write(this.service,b,r.user.personId??r.user.subject);});
 route(AdminHealthGame,'generateTopics',nest.Post,'topics/generate',[nest.Body],function(b){return ai.manual(this.service,b?.id);});
};
