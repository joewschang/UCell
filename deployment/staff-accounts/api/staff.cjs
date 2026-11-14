const {ForbiddenException,BadRequestException,ConflictException}=require('@nestjs/common');
const {randomUUID}=require('node:crypto');
const roles=['SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT','CUSTOMER_SERVICE'];
async function authorize(tx,user){
 if(user?.role!=='SUPER_ADMIN'||!user.personId)throw new ForbiddenException();
 const now=new Date();
 if(!await tx.adminAccessGrant.findFirst({where:{personId:user.personId,provider:user.provider,providerSubject:user.subject,roleCode:'SUPER_ADMIN',status:'ACTIVE',validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]}}))throw new ForbiddenException();
}
exports.list=async(service,req)=>{await authorize(service.prisma,req.user);
 const grants=await service.prisma.adminAccessGrant.findMany({orderBy:{createdAt:'desc'},select:{adminAccessGrantId:true,personId:true,person:{select:{legalName:true}},provider:true,roleCode:true,status:true,validFrom:true,validTo:true}});
 return {data:grants.map(g=>({id:g.adminAccessGrantId,name:g.person.legalName,provider:g.provider,role:g.roleCode,status:g.status,from:g.validFrom,to:g.validTo,self:g.personId===req.user.personId}))};
};
exports.change=(service,req,body)=>service.prisma.$transaction(async tx=>{
 await authorize(tx,req.user);
 const reason=typeof body?.reason==='string'?body.reason.trim():'';
 if(reason.length<2||reason.length>240)throw new BadRequestException('請填寫 2 至 240 字的異動原因。');
 let id,action;
 if(body.action==='create'){
   const subject=String(body.subject||'').trim().toLowerCase(),name=String(body.name||'').trim();
   if(!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(subject)||!roles.includes(body.role)||!name||name.length>80)throw new BadRequestException('請檢查姓名、Entra 識別碼與角色。');
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${subject}))::text`;
   if(await tx.adminAccessGrant.findFirst({where:{provider:'ENTRA',providerSubject:subject}})||await tx.identityLink.findUnique({where:{provider_providerSubject:{provider:'ENTRA',providerSubject:subject}}}))throw new ConflictException('此後台登入身分已存在。');
   const p=await tx.person.create({data:{legalName:name,status:'EFFECTIVE'}});
   const g=await tx.adminAccessGrant.create({data:{personId:p.personId,provider:'ENTRA',providerSubject:subject,roleCode:body.role,createdBy:req.user.personId}});
   id=g.adminAccessGrantId;action='ADMIN_ACCESS_CREATED';
 }else{
   if(!['suspend','resume'].includes(body.action)||!/^\w{8}-[\w-]{27}$/.test(body.id||''))throw new BadRequestException();
   const g=await tx.adminAccessGrant.findUnique({where:{adminAccessGrantId:body.id}});
   if(!g||g.personId===req.user.personId||g.status!==(body.action==='suspend'?'ACTIVE':'SUSPENDED'))throw new ConflictException('此授權目前無法執行這項操作。');
   const status=body.action==='suspend'?'SUSPENDED':'ACTIVE';
   const res=await tx.adminAccessGrant.updateMany({where:{adminAccessGrantId:g.adminAccessGrantId,status:g.status},data:{status}});
   if(res.count!==1)throw new ConflictException('授權狀態已變更，請重新整理。');
   if(status==='SUSPENDED')await tx.authSession.updateMany({where:{personId:g.personId,provider:g.provider,subject:g.providerSubject,roleCode:g.roleCode,status:'ACTIVE'},data:{status:'REVOKED',revokedAt:new Date()}});
   id=g.adminAccessGrantId;action='ADMIN_ACCESS_'+status;
 }
 await service.audit.write(tx,{actorType:'ADMIN',actorId:req.user.personId,actorRoleSnapshot:req.user.role,action,entityType:'AdminAccessGrant',entityId:id,reasonCode:reason,requestId:req.requestId||randomUUID(),correlationId:randomUUID()});
 return {data:{id}};
},{isolationLevel:'Serializable'});
