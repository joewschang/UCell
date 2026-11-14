const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.argv[2];
const text=n=>fs.readFileSync(path.join(root,n+'.js'),'utf8');
const auth=text('member-web-auth.service');
const methods=auth.slice(auth.indexOf('    async hashPassword'),auth.indexOf('    eligible('));
assert(methods.includes('verifyPassword'));
class Err extends Error{constructor(body){super(body.code)}}
const common_1={ConflictException:Err,ForbiddenException:Err,BadRequestException:Err,UnprocessableEntityException:Err};
const hashing=new Function('common_1','derive','node_crypto_1','PASSWORD_MIN','return new class { '+methods+' }')(common_1,crypto.scryptSync,crypto,6);
const ctrl=text('member-identity-link.controller');
const func=ctrl.slice(ctrl.indexOf('    async initialPassword'),ctrl.indexOf('    linkLine(req'));
const controller=new Function('common_1','return new class { '+func+' }')(common_1);
let stored=null;
controller.service={hashPassword:v=>hashing.hashPassword(v),loginMethods:async()=>({line:true,hasPassword:!!stored}),db:{memberPasswordCredential:{create:async({data})=>{if(stored)throw Object.assign(Error(),{code:'P2002'});stored=data.passwordHash;}}}};
(async()=>{
 const req={user:{personId:'test'}};
 await assert.rejects(controller.initialPassword(req,{password:'short'}),/PASSWORD_POLICY/);
 await Promise.all([controller.initialPassword(req,{password:'Password123'}),assert.rejects(controller.initialPassword(req,{password:'Other321'}),/PASSWORD_ALREADY_SET/)]);
 assert(await hashing.verifyPassword('Password123',stored));
 assert.equal(await hashing.verifyPassword('Other321',stored),false);
 await assert.rejects(controller.initialPassword(req,{password:'Other321'}),/PASSWORD_ALREADY_SET/);
 assert(text('member-web-registration.service').includes('if (provider !== "LINE" || input.password !== undefined) await tx.memberPasswordCredential.create'));
 console.log('PASS registration credential condition, weak password, concurrent first setting, existing password verification and overwrite protection');
})().catch(e=>{console.error(e);process.exitCode=1;});
