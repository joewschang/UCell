import {CanActivate,ExecutionContext,Injectable,Logger,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {createRemoteJWKSet,jwtVerify,JWTVerifyGetKey} from 'jose';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {randomUUID} from 'node:crypto';
const guid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface GreetingMachineConfig {tenant:string;audience:string;client:string;objectId:string;}
export async function verifyGreetingMachine(token:string,c:GreetingMachineConfig,key:JWTVerifyGetKey){
 const {payload:p}=await jwtVerify(token,key,{issuer:`https://login.microsoftonline.com/${c.tenant}/v2.0`,audience:c.audience,algorithms:['RS256'],clockTolerance:5,maxTokenAge:'1h'});
 if(p.tid!==c.tenant||p.azp!==c.client||p.oid!==c.objectId||p.idtyp!=='app'||p.scp!==undefined||!Array.isArray(p.roles)||p.roles.length!==1||p.roles[0]!=='Greeting.Generate'||typeof p.iat!=='number'||typeof p.exp!=='number'||p.exp-p.iat>3600||p.exp<=p.iat)throw new Error('claims');
 return `SYSTEM:greeting-machine:${c.objectId}`;
}
@Injectable()
export class GreetingMachineGuard implements CanActivate {
 private logger=new Logger(GreetingMachineGuard.name);private keys=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
 constructor(private db:PrismaService,private audit:AuditService){}
 async canActivate(context:ExecutionContext){
  const c={tenant:process.env.GREETING_MACHINE_TENANT??'',audience:process.env.GREETING_MACHINE_AUDIENCE??'',client:process.env.GREETING_MACHINE_CLIENT??'',objectId:process.env.GREETING_MACHINE_OBJECT_ID??''};
  if(process.env.GREETING_MACHINE_ENABLED!=='true'||![c.tenant,c.audience,c.client,c.objectId].every(x=>guid.test(x)))throw new ServiceUnavailableException({code:'DOT_GREETING_AUTHORIZATION_NOT_CONFIGURED'});
  const req=context.switchToHttp().getRequest(),auth=req.headers?.authorization;
  try{
   if(typeof auth!=='string'||!auth.startsWith('Bearer ')||auth.length>8192)throw Error('bearer');
   let keys=this.keys.get(c.tenant);if(!keys){keys=createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${c.tenant}/discovery/v2.0/keys`),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000});this.keys.set(c.tenant,keys);}
   req.greetingActor=await verifyGreetingMachine(auth.slice(7),c,keys);return true;
  }catch{
   try{await this.db.$transaction(tx=>this.audit.write(tx,{actorType:'SYSTEM',action:'GREETING_MACHINE_DENIED',entityType:'DailyGreeting',result:'DENIED',requestId:randomUUID(),correlationId:randomUUID(),afterData:{reason:'INVALID_MACHINE_BEARER'}}));}catch{this.logger.warn('GREETING_MACHINE_DENIAL_AUDIT_UNAVAILABLE');}
   throw new UnauthorizedException({code:'GREETING_MACHINE_UNAUTHORIZED'});
  }
 }
}
