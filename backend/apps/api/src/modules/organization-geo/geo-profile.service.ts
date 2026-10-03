import {Injectable,ServiceUnavailableException} from '@nestjs/common';
import {Prisma,PrismaService,PiiCryptoService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {communicationAddressFingerprint,GEO_AREA_VERSION,normalizeCommunicationAddress} from './geo-normalization';

/** Derive administrative geography from approved individual communication-address evidence.
 * No delivery-address fallback, no representative-to-company ownership substitution.
 */
@Injectable()
export class GeoProfileService {
 constructor(private readonly db:PrismaService,private readonly pii:PiiCryptoService){}
 async refresh(after?:string,limit=100){
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('GEO_REFRESH_LIMIT_INVALID');
  const secret=process.env.IDENTITY_MATCH_HMAC_SECRET;
  if(!secret||secret.length<32)throw new ServiceUnavailableException({code:'GEO_ADDRESS_HMAC_CONFIGURATION_PENDING'});
  // Approval audit is immutable evidence; today's mutable application status is not historical authority.
  const approvals=await this.db.auditEvent.findMany({where:{action:'FORMAL_APPLICATION_APPROVED',...(after?{auditEventId:{gt:after}}:{})},orderBy:{auditEventId:'asc'},take:limit+1});
  let created=0,skipped=0;
  for(const approval of approvals.slice(0,limit)){
   const app=approval.entityId?await this.db.formalMemberApplication.findUnique({where:{formalMemberApplicationId:approval.entityId}}):null;
   if(!app||app.applicantType!=='INDIVIDUAL'){skipped++;continue;}
   const snapshot=await this.db.formalMemberApplicationSnapshot.findFirst({where:{formalMemberApplicationId:app.formalMemberApplicationId,createdAt:{lte:approval.occurredAt}},orderBy:{version:'desc'}});
   if(!snapshot)throw new ServiceUnavailableException({code:'GEO_APPROVED_ADDRESS_SNAPSHOT_MISSING'});
   const payload=this.pii.decrypt<{communicationAddress?:string;applicantType?:string}>(snapshot.payloadCiphertext,snapshot.keyVersion);
   if(createHash('sha256').update(JSON.stringify(payload)).digest('hex')!==snapshot.payloadHash)throw new ServiceUnavailableException({code:'GEO_ADDRESS_SNAPSHOT_HASH_MISMATCH'});
   if(payload.applicantType!=='INDIVIDUAL')throw new ServiceUnavailableException({code:'GEO_APPROVED_ADDRESS_SOURCE_MISMATCH'});
   const address=payload.communicationAddress??'',geo=normalizeCommunicationAddress(address);
   const data={memberId:app.personId,countryCode:geo.countryCode,cityCode:geo.cityCode,districtCode:geo.districtCode,geoStatus:geo.status,geoSource:'APPROVED_FORMAL_COMMUNICATION_ADDRESS',geoConfidence:new Prisma.Decimal(geo.confidence),reasonCode:geo.reason,addressHash:communicationAddressFingerprint(address,'TW',secret),sourceSnapshotId:snapshot.formalMemberApplicationSnapshotId,sourceEffectiveAt:approval.occurredAt,sourceRecordedAt:approval.occurredAt,normalizedAt:new Date(),definitionVersion:GEO_AREA_VERSION};
   const inserted=await this.db.$transaction(async tx=>{
    // Serializes concurrent refresh and prevents older backfill from overwriting a newer current profile.
    await tx.$queryRaw`SELECT true FROM (SELECT pg_advisory_xact_lock(hashtextextended(${app.personId},817))) lock_row`;
    const existing=await tx.memberGeoProfileVersion.findUnique({where:{memberId_sourceSnapshotId_definitionVersion:{memberId:app.personId,sourceSnapshotId:data.sourceSnapshotId,definitionVersion:GEO_AREA_VERSION}}});
    if(existing)return false;
    await tx.memberGeoProfileVersion.create({data:{geoProfileVersionId:randomUUID(),...data}});
    const current=await tx.memberGeoProfile.findUnique({where:{memberId:app.personId}});
    if(!current||current.sourceEffectiveAt<data.sourceEffectiveAt)await tx.memberGeoProfile.upsert({where:{memberId:app.personId},create:data,update:{...data,updatedAt:new Date()}});
    return true;
   });
   if(inserted)created++;
  }
  return {created,skipped,nextCursor:approvals.length>limit?approvals[limit-1].auditEventId:null,definitionVersion:GEO_AREA_VERSION};
 }
}
