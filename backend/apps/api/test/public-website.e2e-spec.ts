import {Prisma} from '@prisma/client';
import {PublicWebsiteService} from '../src/modules/public-website/public-website.module';
it('exposes only the current approved public content and never resurrects private or expired versions',async()=>{
 const now=new Date('2026-10-19T12:00:00Z'),base={audiencePolicy:'PUBLIC',title:'Public video',summary:'Summary',externalUrl:'https://example.com/watch',publishTo:null,approvedAt:now};
 const read=jest.fn().mockResolvedValue([
  {contentId:'public',contentType:'VIDEO_EXTERNAL',versions:[{...base,approvalReference:'PRIVATE_APPROVAL'}]},
  {contentId:'private',contentType:'EXTERNAL_LINK',versions:[{...base,audiencePolicy:'NETWORK_MEMBER'}]},
  {contentId:'expired',contentType:'EXTERNAL_LINK',versions:[{...base,publishTo:now}]},
  {contentId:'draft',contentType:'EXTERNAL_LINK',versions:[]},
  {contentId:'unsafe',contentType:'EXTERNAL_LINK',versions:[{...base,externalUrl:'javascript:alert(1)'}]},
  {contentId:'credentials',contentType:'EXTERNAL_LINK',versions:[{...base,externalUrl:'https://user:password@example.com'}]}
 ]);
 const result=await new PublicWebsiteService({publishedContent:{findMany:read}} as any).content(now);
 expect(result).toEqual([{id:'public',type:'VIDEO_EXTERNAL',title:'Public video',summary:'Summary',url:'https://example.com/watch',thumbnailUrl:null,shareable:undefined,publishedAt:now.toISOString()}]);
 const query=read.mock.calls[0][0];expect(query.where.status).toBe('PUBLISHED');
 expect(query.select.versions).toMatchObject({take:1,orderBy:{version:'desc'},where:{status:'PUBLISHED',approvedAt:{not:null},OR:[{publishFrom:null},{publishFrom:{lte:now}}]}});
 // Select latest effective version BEFORE deciding public visibility.
 expect(query.select.versions.where).not.toHaveProperty('audiencePolicy');
 expect(query.select.versions.where).not.toHaveProperty('publishTo');
 expect(query.select.versions.select).not.toHaveProperty('approvalReference');
});
it('returns only public catalog fields and fails closed on ambiguous product rules',async()=>{
 const read=jest.fn().mockResolvedValue([{sku:'TIP-636',displayName:'Product',iconUrl:'/products/tip-636.png',currentPrice:new Prisma.Decimal(4800),currency:'TWD',ruleProfiles:[{ruleVersionCode:'R1.0B',parameterSnapshotHash:'a'.repeat(64)}],privateField:'secret'},{sku:'TIP-777',displayName:'Unavailable',currentPrice:new Prisma.Decimal(4800),currency:'TWD',ruleProfiles:[]},{sku:'TIP-INTERNAL',displayName:'Internal',currentPrice:new Prisma.Decimal(1),currency:'TWD',ruleProfiles:[]}]);
 const result=await new PublicWebsiteService({productReference:{findMany:read}} as any).products();
 expect(result).toEqual([{sku:'TIP-636',name:'Product',iconUrl:'/products/tip-636.png',price:'4800',currency:'TWD',available:true},{sku:'TIP-777',name:'Unavailable',iconUrl:null,price:'4800',currency:'TWD',available:false}]);
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

it.each(['https://evil.example/image.png','//evil.example/x.png','/products/../private.png','/products/x.svg','data:image/png;base64,x','/products/x.png?token=secret'])('does not publish unsafe product artwork URL %s',async iconUrl=>{
 const result=await new PublicWebsiteService({productReference:{findMany:async()=>[{sku:'TIP-363',displayName:'Product',iconUrl,currentPrice:new Prisma.Decimal(4800),currency:'TWD',ruleProfiles:[]}]}} as any).products();expect(result[0].iconUrl).toBeNull();
});
