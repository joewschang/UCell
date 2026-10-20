import {shareCardHtml} from '../src/modules/content/share-card-html';
import {ForbiddenException} from '@nestjs/common';
import {MemberShareLinkService} from '../src/modules/member/member-share-link.service';
import {ContentService} from '../src/modules/content/content.service';
import {currentContent,safeContentUrl} from '../src/modules/content/content-visibility';
import {ContentInsightsService} from '../src/modules/content/content-insights.service';
const now=new Date('2026-10-20T00:00:00Z'),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function harness(){
 const version={contentVersionId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',title:'Published',summary:'Summary',externalUrl:'https://example.com/video',thumbnailUrl:null,audiencePolicy:'PUBLIC',shareable:true,approvedAt:now,publishTo:null};
 const content={contentId:id,contentType:'VIDEO_EXTERNAL',versions:[version]};
 const links=new Map<string,any>();
 const db:any={publishedContent:{findFirst:jest.fn(async()=>content),findMany:jest.fn(async()=>[content])},person:{findUnique:jest.fn(async()=>({membershipState:'NETWORK_MEMBER'}))},
 referralLink:{create:jest.fn(async({data}:any)=>{const row={referralLinkId:id,status:'ACTIVE',...data};links.set(data.tokenHash,row);return row}),findUnique:jest.fn(async({where}:any)=>links.get(where.tokenHash)),updateMany:jest.fn(async()=>({count:1}))},
 $executeRaw:jest.fn(),$queryRaw:jest.fn(async()=>[])};
 db.$transaction=(work:any)=>work(db);
 const access={assertHolder:jest.fn(async()=>({ownerType:'PERSON'}))},service=new MemberShareLinkService(access as any,db);
 return {version,content,db,access,service,links};
}
beforeAll(()=>{process.env.MEMBER_SHARE_TOKEN_SECRET='TEST_ONLY_CONTENT_SHARING_32_CHAR_SECRET';process.env.MEMBER_REFERRAL_BASE_URL='https://member.test.invalid';process.env.MEMBER_SHARE_TOKEN_TTL_SECONDS='86400';});
it('binds the content/version inside the encrypted token and atomically saves metadata',async()=>{
 const h=harness(),result=await h.service.create('person','ball',now,id),token=new URL(result.shareUrl).pathname.split('/').pop()!;
 expect(h.service.verify(token,now)).toMatchObject({contentId:id,contentVersionId:h.version.contentVersionId,qualificationId:'ball'});
 expect(result.shareUrl).not.toContain(id);expect(h.db.$executeRaw).toHaveBeenCalledTimes(1);
 expect(await h.service.preview(token,now)).toMatchObject({content:{title:'Published'},requiresLogin:false,destination:'/content/'+id});
});
it.each(['NETWORK_MEMBER','PUBLIC'])('refuses sharing disabled %s content',async audiencePolicy=>{
 const h=harness();h.version.audiencePolicy=audiencePolicy;h.version.shareable=false;
 await expect(h.service.create('person','ball',now,id)).rejects.toMatchObject({response:{code:'CONTENT_NOT_SHAREABLE'}});
 expect(h.db.referralLink.create).not.toHaveBeenCalled();
});
it('hides all member-only metadata from anonymous previews, and rechecks cancellation after link creation',async()=>{
 const h=harness();h.version.audiencePolicy='NETWORK_MEMBER';
 const link=await h.service.create('person','ball',now,id),token=new URL(link.shareUrl).pathname.split('/').pop()!;
 const result=await h.service.preview(token,now);expect(result.content).toBeNull();expect(JSON.stringify(result)).not.toContain('example.com');expect(result.requiresLogin).toBe(true);
 h.version.shareable=false;await expect(h.service.preview(token,now)).rejects.toMatchObject({response:{code:'SHARE_CONTENT_UNAVAILABLE'}});
});
it('rejects revoked, expired, tampered and archived links without creating attribution',async()=>{
 const h=harness(),link=await h.service.create('person','ball',now,id),token=new URL(link.shareUrl).pathname.split('/').pop()!;
 await expect(h.service.preview(token,new Date(now.getTime()+86400001))).rejects.toThrow();
 await expect(h.service.preview((token[0]==='A'?'B':'A')+token.slice(1),now)).rejects.toThrow();
 h.links.get(h.service.hash(token)).status='REVOKED';await expect(h.service.preview(token,now)).rejects.toThrow();
 h.links.get(h.service.hash(token)).status='ACTIVE';h.db.publishedContent.findFirst.mockResolvedValue(null);await expect(h.service.preview(token,now)).rejects.toThrow();
});
it('authorizes ownership before both creation and revocation',async()=>{
 const h=harness();h.access.assertHolder.mockRejectedValue(new ForbiddenException());
 await expect(h.service.create('other','ball',now,id)).rejects.toThrow();
 await expect(h.service.revoke('other','ball',id)).rejects.toThrow();
 expect(h.db.referralLink.create).not.toHaveBeenCalled();expect(h.db.referralLink.updateMany).not.toHaveBeenCalled();
});
it('does not resurrect old versions after expiry and checks the parent publication status',async()=>{
 const h=harness();h.version.publishTo=now as any;expect(await currentContent(h.db,id,now)).toBeNull();
 const query=h.db.publishedContent.findFirst.mock.calls[0][0];expect(query.where.status).toBe('PUBLISHED');
 expect(query.include.versions.where).not.toHaveProperty('publishTo');expect(query.include.versions.where).not.toHaveProperty('audiencePolicy');
});
it('allows members without a qualification to read public and member content, but rejects unknown audiences',async()=>{
 const h=harness(),service=new ContentService(h.db,{} as any,{} as any);
 for(const audience of ['PUBLIC','NETWORK_MEMBER']){h.version.audiencePolicy=audience;expect(await service.get('network-person',id,now)).toMatchObject({id});}
 h.version.audiencePolicy='INTERNAL';await expect(service.get('network-person',id,now)).rejects.toThrow();
});
it('never returns private content from the public detail endpoint',async()=>{
 const h=harness();h.version.audiencePolicy='NETWORK_MEMBER';await expect(new ContentService(h.db,{} as any,{} as any).publicDetail(id,now)).rejects.toThrow();
});
it.each(['javascript:alert(1)','http://example.com','https://user:secret@example.com','data:text/html,test'])('rejects unsafe external URL %s',url=>expect(safeContentUrl(url)).toBeNull());
it('authorizes insight reads before running any aggregate query',async()=>{
 const h=harness();h.access.assertHolder.mockRejectedValue(new ForbiddenException());
 await expect(new ContentInsightsService(h.db,h.access as any).read('other','ball',now)).rejects.toThrow();expect(h.db.$queryRaw).not.toHaveBeenCalled();
});

it('escapes social preview markup and renders no member data in a private preview',()=>{
 const html=shareCardHtml({title:'<script>alert(1)</script>',summary:'" onload="bad',thumbnailUrl:'https://example.com/a?x="'});
 expect(html).not.toContain('<script>alert');expect(html).toContain('&lt;script&gt;');expect(html.match(/<script /g)).toHaveLength(1);
 expect(shareCardHtml(null)).not.toContain('og:image');
});
