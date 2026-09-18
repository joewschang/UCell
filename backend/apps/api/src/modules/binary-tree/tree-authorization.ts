import {ForbiddenException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
export interface TreePrincipal {sessionId:string;personId?:string;provider:string;subject:string;role:string;}
export async function authorizeTreePrincipal(db:PrismaService,p:TreePrincipal|undefined,roles:readonly string[],tx?:Prisma.TransactionClient){
  if(!p || p.provider!=='ENTRA' || !p.personId || !roles.includes(p.role))throw new ForbiddenException({code:'TREE_ACCESS_DENIED'});
  const client=tx??db,now=new Date();
  if(tx)await tx.$queryRaw`SELECT auth_session_id FROM identity.auth_session WHERE auth_session_id=${p.sessionId}::uuid FOR SHARE`;
  const [session,link,grants]=await Promise.all([
   client.authSession.findUnique({where:{authSessionId:p.sessionId}}),client.identityLink.findUnique({where:{provider_providerSubject:{provider:'ENTRA',providerSubject:p.subject}}}),
   client.adminAccessGrant.findMany({where:{personId:p.personId,provider:'ENTRA',providerSubject:p.subject,roleCode:p.role,status:'ACTIVE',validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},take:2}),
  ]);
  if(!session || session.status!=='ACTIVE' || session.revokedAt || session.expiresAt<=now || session.personId!==p.personId || session.subject!==p.subject || session.roleCode!==p.role || session.provider!=='ENTRA' || link?.personId!==p.personId || grants.length!==1)throw new ForbiddenException({code:'TREE_ACCESS_DENIED'});
  if(tx)await tx.$queryRaw`SELECT admin_access_grant_id FROM identity.admin_access_grant WHERE admin_access_grant_id=${grants[0].adminAccessGrantId}::uuid FOR SHARE`;
  return p.personId;

}
