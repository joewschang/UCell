import {Injectable} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
/** Public projections deliberately exclude member identity, bonus parameters,
 * registration records, meeting credentials and internal approval evidence. */
@Injectable()
export class PublicWebsiteService{
 constructor(private readonly db:PrismaService){}
 async products(now=new Date()){
  const rows=await this.db.productReference.findMany({where:{isActive:true,sku:{startsWith:'TIP-'}},select:{sku:true,displayName:true,currentPrice:true,currency:true,ruleProfiles:{where:{effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},select:{ruleVersionCode:true,parameterSnapshotHash:true}}},orderBy:{sku:'asc'},take:100});
  return rows.filter(r=>/^TIP-\d{3}$/.test(r.sku)).map(r=>({sku:r.sku,name:r.displayName,price:r.currentPrice.toString(),currency:r.currency,available:r.ruleProfiles.length===1&&r.ruleProfiles[0].ruleVersionCode==='R1.0B'&&/^[a-f0-9]{64}$/.test(r.ruleProfiles[0].parameterSnapshotHash??'')}));
 }
 async events(now=new Date()){
  const rows=await this.db.memberEvent.findMany({where:{status:'PUBLISHED'},select:{eventCode:true,versions:{where:{status:'PUBLISHED',audiencePolicy:'NETWORK_MEMBER',approvedAt:{not:null}},orderBy:{version:'desc'},take:1,select:{title:true,description:true,eventType:true,startsAt:true,endsAt:true}}},orderBy:{eventCode:'asc'},take:100});
  return rows.flatMap(row=>{const v=row.versions[0];return v&&v.endsAt>now?[{eventCode:row.eventCode,title:v.title,description:v.description,eventType:v.eventType,startsAt:v.startsAt.toISOString(),endsAt:v.endsAt.toISOString(),canRegister:v.startsAt>now}]:[];}).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
 }
}
