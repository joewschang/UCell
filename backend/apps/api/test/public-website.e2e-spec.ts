import {Prisma} from '@prisma/client';
import {PublicWebsiteService} from '../src/modules/public-website/public-website.module';
it('returns only public catalog fields and fails closed on ambiguous product rules',async()=>{
 const read=jest.fn().mockResolvedValue([{sku:'TIP-636',displayName:'Product',currentPrice:new Prisma.Decimal(4800),currency:'TWD',ruleProfiles:[{ruleVersionCode:'R1.0B',parameterSnapshotHash:'a'.repeat(64)}],privateField:'secret'},{sku:'TIP-777',displayName:'Unavailable',currentPrice:new Prisma.Decimal(4800),currency:'TWD',ruleProfiles:[]},{sku:'TIP-INTERNAL',displayName:'Internal',currentPrice:new Prisma.Decimal(1),currency:'TWD',ruleProfiles:[]}]);
 const result=await new PublicWebsiteService({productReference:{findMany:read}} as any).products();
 expect(result).toEqual([{sku:'TIP-636',name:'Product',price:'4800',currency:'TWD',available:true},{sku:'TIP-777',name:'Unavailable',price:'4800',currency:'TWD',available:false}]);
 expect(read.mock.calls[0][0].where).toEqual({isActive:true,sku:{startsWith:'TIP-'}});
 expect(read.mock.calls[0][0].select).not.toHaveProperty('productId');
});
it('publishes only approved event projections, removes ended events and never exposes meeting links',async()=>{
 const now=new Date('2026-10-19T01:00:00Z'),v={title:'Event',description:'Public copy',eventType:'ONLINE',startsAt:new Date('2026-10-20'),endsAt:new Date('2026-10-21'),onlineJoinReference:'private-url'};
 const read=jest.fn().mockResolvedValue([{eventCode:'FUTURE',versions:[v]},{eventCode:'ENDED',versions:[{...v,endsAt:new Date('2026-10-18')}]},{eventCode:'DRAFT',versions:[]}]);
 const result=await new PublicWebsiteService({memberEvent:{findMany:read}} as any).events(now);
 expect(result).toHaveLength(1);expect(result[0]).toMatchObject({eventCode:'FUTURE',canRegister:true});expect(result[0]).not.toHaveProperty('onlineJoinReference');
 const query=read.mock.calls[0][0];expect(query.where).toEqual({status:'PUBLISHED'});expect(query.select.versions.where).toEqual({status:'PUBLISHED',audiencePolicy:'NETWORK_MEMBER',approvedAt:{not:null}});
 expect(query.select).not.toHaveProperty('registrations');
});
