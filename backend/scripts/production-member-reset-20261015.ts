import * as fs from 'node:fs';
import {randomUUID,randomBytes,createCipheriv,createHash} from 'node:crypto';
import {PrismaService} from '../packages/database/src';
import {BinaryTreeService} from '../apps/api/src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../apps/api/src/modules/organization/organization.service';
import {IdempotencyService} from '../apps/api/src/common/idempotency/idempotency.service';
const dir='C:/UCell/releases/production-20261014';
const url=new URL(process.env.DATABASE_URL!);if(url.hostname!=='ucellprod-pg-m3z2zx4ohqyui.postgres.database.azure.com'||url.pathname!=='/ucell_production')throw Error('WRONG_DATABASE');
const targets:string[]=JSON.parse(fs.readFileSync(dir+'/reset-targets.json','utf8'));
const inv=JSON.parse(fs.readFileSync(dir+'/reset-inventory.json','utf8'));
const quote=(t:string)=>{if(!/^[a-z_]+\.[a-z_]+$/.test(t))throw Error('INVALID_TABLE');return t.split('.').map(x=>'"'+x+'"').join('.')};
const db=new PrismaService();
async function main(){
const result=await db.$transaction(async tx=>{
 await tx.$executeRawUnsafe('SET LOCAL lock_timeout = \'10s\'');
 await tx.$executeRawUnsafe('LOCK TABLE '+[...targets,'identity.person','identity.identity_link','identity.auth_session','integration.idempotency_record','integration.outbox_event'].map(quote).join(',')+' IN ACCESS EXCLUSIVE MODE');
 const grants=await tx.adminAccessGrant.findMany({where:{status:'ACTIVE'}});const adminIds=[...new Set(grants.map(g=>g.personId))];if(adminIds.length!==2)throw Error('ADMIN_COUNT_CHANGED');
 const members=await tx.person.findMany({where:{personId:{notIn:adminIds}},select:{personId:true}});if(members.length!==1)throw Error('MEMBER_COUNT_CHANGED');
 if(await tx.payment.count()||await tx.bonusAward.count()||await tx.payableEntry.count())throw Error('FINANCIAL_ACTIVITY_REQUIRES_REVIEW');
 const session=await tx.authSession.findFirst({where:{personId:{in:adminIds},provider:'ENTRA',roleCode:'SUPER_ADMIN',status:'ACTIVE',revokedAt:null,expiresAt:{gt:new Date()}},orderBy:{issuedAt:'desc'}});if(!session)throw Error('ACTIVE_ADMIN_SESSION_REQUIRED');
 const oldTrees=await tx.binaryTree.findMany();if(oldTrees.length!==1||oldTrees[0].treeCode!=='UCELL001')throw Error('TREE_CHANGED');
 const oldBalls=await tx.qualification.findMany({select:{qualificationId:true}});
 const oldCompany=await tx.companyPrincipal.findMany();if(oldCompany.length!==1)throw Error('COMPANY_CHANGED');
 const removedIds=[...members.map(x=>x.personId),...oldBalls.map(x=>x.qualificationId),oldTrees[0].binaryTreeId,oldCompany[0].companyPrincipalId];
 const backup:any={createdAt:new Date().toISOString(),tables:{}};
 for(const t of [...targets,'identity.person','identity.identity_link','identity.auth_session','integration.idempotency_record','integration.outbox_event']){
 const rows=await tx.$queryRawUnsafe<any[]>('SELECT to_jsonb(t) row FROM '+quote(t)+' t');if(rows.length)backup.tables[t]=rows.map(r=>r.row);
 }
 if(process.env.RESET_APPLY==='YES'){const key=Buffer.from(process.env.RESET_BACKUP_KEY!,'base64');if(key.length!==32)throw Error('BACKUP_KEY_REQUIRED');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const plaintext=Buffer.from(JSON.stringify(backup));const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);const backupPath=dir+'/member-reset-backup-20261015.enc';if(fs.existsSync(backupPath))throw Error('BACKUP_ALREADY_EXISTS');fs.writeFileSync(backupPath,Buffer.concat([iv,cipher.getAuthTag(),encrypted]));}
 await tx.$executeRawUnsafe('TRUNCATE TABLE '+targets.map(quote).join(',')+' RESTRICT');
 const memberIds=members.map(x=>x.personId);
 const guards=[['identity.auth_session','trg_auth_session_no_delete'],['identity.identity_link','trg_identity_link_no_delete'],['identity.person','trg_person_no_delete']];
 for(const [table,trigger] of guards)await tx.$executeRawUnsafe('ALTER TABLE '+quote(table)+' DISABLE TRIGGER '+trigger);
 await tx.authSession.deleteMany({where:{personId:{in:memberIds}}});await tx.identityLink.deleteMany({where:{personId:{in:memberIds}}});await tx.person.deleteMany({where:{personId:{in:memberIds}}});
 for(const [table,trigger] of guards)await tx.$executeRawUnsafe('ALTER TABLE '+quote(table)+' ENABLE TRIGGER '+trigger);
 const pending=await tx.idempotencyRecord.findMany();for(const row of pending)if(removedIds.some(id=>JSON.stringify(row).includes(id)))await tx.idempotencyRecord.delete({where:{idempotencyRecordId:row.idempotencyRecordId}});
 const outbox=await tx.outboxEvent.findMany();for(const row of outbox)if(removedIds.some(id=>JSON.stringify(row).includes(id)))await tx.outboxEvent.delete({where:{outboxEventId:row.outboxEventId}});
 const company=await tx.companyPrincipal.create({data:{code:'UCELL_COMPANY',displayName:oldCompany[0].displayName,status:'ACTIVE'}});
 const adapter=new Proxy(tx,{get(target,prop){if(prop==='$transaction')return (fn:any)=>fn(tx);return (target as any)[prop];}}) as any;
 const service=new BinaryTreeService(adapter,new IdempotencyService(adapter),new OrganizationService(adapter));
 const principal={personId:session.personId!,provider:'ENTRA',subject:session.subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
 const tree=(await service.create(principal,{treeCode:'UCELL001',treeName:oldTrees[0].treeName,reason:'依會員資料重置指示重建公司球，保留正式制度設定'},randomUUID())).value;
 await service.change(principal,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'會員資料重置後啟用公司組織'},randomUUID());
 if(await tx.qualification.count()!==7||await tx.person.count()!==2||await tx.formalMemberApplication.count()!==0||await tx.order.count()!==0)throw Error('RESET_POSTCONDITION_FAILED');
 const id=randomUUID();await tx.auditEvent.create({data:{actorType:'USER',actorId:session.personId,action:'AUTHORIZED_MEMBER_QUALIFICATION_RESET',entityType:'CompanyPrincipal',entityId:company.companyPrincipalId,requestId:id,correlationId:id,afterData:{removedMembers:members.length,rebuiltCompanyBalls:7,preservedAdminIdentities:2,backupCreated:process.env.RESET_APPLY==='YES'}}});
 if(process.env.RESET_APPLY!=='YES')throw Error('DRY_RUN_ROLLBACK_PASS');
 return {completedAt:new Date().toISOString(),removedMembers:members.length,remainingMemberAccounts:0,preservedAdminIdentities:2,formalApplications:0,orders:0,companyPrincipalId:company.companyPrincipalId,treeId:tree.binaryTreeId,treeCode:tree.treeCode,status:'ACTIVE',companyBallNos:tree.companyBallNos};
},{timeout:180000,maxWait:10000});
fs.writeFileSync(dir+'/member-reset-result-20261015.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
