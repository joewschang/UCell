import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { normalizeTaiwanAddress } from './address-normalization';
import type { GeoArea } from './address-normalization';

/** Internal trusted address-event consumer. No residential address is persisted here. */
@Injectable()
export class GeoProfileService {
  constructor(private readonly db: PrismaService) {}

  async recognize(input: { personId: string; sourceEventId: string; address: string; countryCode: string; effectiveAt: string; catalogVersion: string; hashKeyVersion: string }, hashKey: string) {
    const at = new Date(input.effectiveAt);
    if (!Number.isFinite(at.getTime()) || at > new Date() || !input.hashKeyVersion) throw new UnprocessableEntityException({code:'INVALID_GEO_SOURCE_CONTEXT'});
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.personId}, 1101))`;
      const areas = await tx.geoAdminArea.findMany({where:{catalogVersion:input.catalogVersion,countryCode:input.countryCode,isActive:true}});
      if (input.countryCode === 'TW' && !areas.length) throw new ConflictException({code:'GEO_CATALOG_NOT_AVAILABLE'});
      const catalog: GeoArea[] = areas.map(a => ({countryCode:a.countryCode,level:a.level as GeoArea['level'],areaCode:a.areaCode,parentAreaCode:a.parentAreaCode,name:a.areaNameZh,aliases:Array.isArray(a.aliases)?a.aliases.filter((x):x is string=>typeof x==='string'):[]}));
      const normalized = normalizeTaiwanAddress(input.address,input.countryCode,catalog,input.catalogVersion,hashKey);
      const data = {personId:input.personId,countryCode:normalized.countryCode,cityCode:normalized.cityCode,districtCode:normalized.districtCode,geoStatus:normalized.status,reason:normalized.reason,addressHash:normalized.addressHash,hashKeyVersion:input.hashKeyVersion,catalogVersion:input.catalogVersion,geoSource:'COMMUNICATION_ADDRESS_EVENT'};
      const existing = await tx.memberGeoProfileEvent.findUnique({where:{sourceEventId:input.sourceEventId}});
      if (existing) {
        if (existing.personId!==input.personId || existing.effectiveAt.getTime()!==at.getTime() || existing.addressHash!==data.addressHash || existing.catalogVersion!==data.catalogVersion || existing.hashKeyVersion!==data.hashKeyVersion) throw new ConflictException({code:'GEO_SOURCE_IDEMPOTENCY_CONFLICT'});
        return {eventId:existing.eventId,replayed:true};
      }
      const sameTime = await tx.memberGeoProfileEvent.findFirst({where:{personId:input.personId,effectiveAt:at}});
      if (sameTime && (sameTime.addressHash!==data.addressHash || sameTime.hashKeyVersion!==data.hashKeyVersion || sameTime.catalogVersion!==data.catalogVersion)) throw new ConflictException({code:'AMBIGUOUS_GEO_EFFECTIVE_TIME'});
      const event = await tx.memberGeoProfileEvent.create({data:{...data,sourceEventId:input.sourceEventId,effectiveAt:at}});
      const latest = await tx.memberGeoProfileEvent.findFirst({where:{personId:input.personId},orderBy:[{effectiveAt:'desc'},{recordedAt:'desc'}]});
      if (latest?.eventId===event.eventId) await tx.memberGeoProfile.upsert({where:{personId:input.personId},create:{...data,normalizedAt:at},update:{...data,normalizedAt:at}});
      return {eventId:event.eventId,replayed:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async at(tx: Prisma.TransactionClient, personId: string, asOf: Date, knowledgeCutoff: Date) {
    const rows = await tx.memberGeoProfileEvent.findMany({where:{personId,effectiveAt:{lte:asOf},recordedAt:{lte:knowledgeCutoff}},orderBy:[{effectiveAt:'desc'},{recordedAt:'desc'}],take:2});
    const row = rows[0];
    if (!row) return {status:'UNAVAILABLE' as const,cityCode:null,districtCode:null,reason:'GEO_HISTORY_MISSING'};
    if (rows[1]?.effectiveAt.getTime()===row.effectiveAt.getTime() && (rows[1].addressHash!==row.addressHash || rows[1].catalogVersion!==row.catalogVersion || rows[1].hashKeyVersion!==row.hashKeyVersion)) return {status:'UNAVAILABLE' as const,cityCode:null,districtCode:null,reason:'AMBIGUOUS_GEO_HISTORY'};
    return {status:row.geoStatus,cityCode:row.cityCode,districtCode:row.districtCode,reason:row.reason,catalogVersion:row.catalogVersion,lastUpdated:row.recordedAt.toISOString()};
  }
}
