import {createHash} from 'node:crypto';
import {LineRichMenuClient,LineRichMenuError,LineRichMenuReconciler} from '../../worker/src/line-rich-menu-reconciliation';
import {createLineMessagingObserverHandler} from '../../worker/src/line-messaging-handler';

const uid='U'+'a'.repeat(32),defaultId='richmenu-'+'d'.repeat(32),memberId='richmenu-'+'b'.repeat(32),oldId='richmenu-'+'c'.repeat(32);
const binding={identityLinkId:'binding-1',providerSubject:uid,status:'ACTIVE',person:{status:'EFFECTIVE',securityStatus:'NORMAL'}};
function fixture(current:string|null=null,eventType:string|null=null){
 let menu=current;
 const client={ready:jest.fn().mockResolvedValue(undefined),getUserMenu:jest.fn(async()=>menu),link:jest.fn(async(_u:string,id:string)=>{menu=id;}),unlink:jest.fn(async()=>{menu=null;})};
 const db={identityLink:{findMany:jest.fn().mockResolvedValue([binding])},lineMessagingEvent:{findFirst:jest.fn().mockResolvedValue(eventType?{eventType}:null)}};
 return {client,db,reconciler:new LineRichMenuReconciler(db,client,memberId)};
}
describe('LINE rich menu reconciliation',()=>{
 it.each(['new friend','pre-webhook existing friend','per-user menu missing'])('repairs %s without requiring follow history',async()=>{
  const f=fixture();expect(await f.reconciler.reconcile(binding)).toBe('LINKED');
  expect(f.client.ready.mock.invocationCallOrder[0]).toBeLessThan(f.client.link.mock.invocationCallOrder[0]);
  expect(f.db.lineMessagingEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({sourceSubjectHash:createHash('sha256').update(uid).digest('hex')})}));
 });
 it('keeps an already bound member link idempotently',async()=>{const f=fixture(memberId);expect(await f.reconciler.reconcile(binding)).toBe('UNCHANGED');expect(f.client.link).not.toHaveBeenCalled();});
 it('unbound or failed bindings still have a global default with no per-user work',async()=>{const f=fixture();f.db.identityLink.findMany.mockResolvedValue([]);expect(await f.reconciler.batch()).toMatchObject({checked:0,failures:0,scanComplete:true});expect(f.client.ready).toHaveBeenCalled();expect(f.client.link).not.toHaveBeenCalled();});
 it('revoked binding unlinks personalized menu only after ensuring default fallback',async()=>{const f=fixture(memberId);expect(await f.reconciler.reconcile({...binding,status:'REVOKED'})).toBe('DEFAULT');expect(f.client.ready.mock.invocationCallOrder[0]).toBeLessThan(f.client.unlink.mock.invocationCallOrder[0]);});
 it('does not link while blocked and repairs after unblock follow event',async()=>{const f=fixture(null,'unfollow');expect(await f.reconciler.reconcile(binding)).toBe('BLOCKED');expect(f.client.link).not.toHaveBeenCalled();f.db.lineMessagingEvent.findFirst.mockResolvedValue({eventType:'follow'});expect(await f.reconciler.reconcile(binding)).toBe('LINKED');});
 it('replaces an obsolete per-user menu and verifies readback',async()=>{const f=fixture(oldId);expect(await f.reconciler.reconcile(binding)).toBe('REPLACED');expect(f.client.link).toHaveBeenCalledWith(uid,memberId);expect(f.client.getUserMenu).toHaveBeenCalledTimes(2);});
 it('missing replacement falls back to default rather than leaving an obsolete link',async()=>{const f=fixture(oldId);f.client.link.mockRejectedValue(new LineRichMenuError(404));expect(await f.reconciler.reconcile(binding)).toBe('FALLBACK');expect(f.client.unlink).toHaveBeenCalledWith(uid);});
 it('a member with no link still inherits default when its personal menu is missing',async()=>{const f=fixture();f.client.link.mockRejectedValue(new LineRichMenuError(404));expect(await f.reconciler.reconcile(binding)).toBe('FALLBACK');expect(f.client.unlink).not.toHaveBeenCalled();});
 it('transient link failure keeps a working menu and retries in the next scan',async()=>{const f=fixture(oldId);f.client.link.mockRejectedValueOnce(new LineRichMenuError(429));expect(await f.reconciler.batch()).toMatchObject({failures:1});expect(f.client.unlink).not.toHaveBeenCalled();expect(await f.reconciler.batch()).toMatchObject({REPLACED:1,failures:0});});
 it('never mutates a user link if fallback cannot be verified',async()=>{const f=fixture(oldId);f.client.ready.mockRejectedValue(new LineRichMenuError(503));await expect(f.reconciler.batch()).rejects.toThrow('503');expect(f.client.link).not.toHaveBeenCalled();expect(f.client.unlink).not.toHaveBeenCalled();});
 it('skips synthetic ids and reports only aggregate outcomes',async()=>{const f=fixture();f.db.identityLink.findMany.mockResolvedValue([{...binding,providerSubject:'stage-test'}]);const result=await f.reconciler.batch();expect(result).toMatchObject({SKIPPED:1,failures:0});expect(JSON.stringify(result)).not.toContain('stage-test');expect(f.client.getUserMenu).not.toHaveBeenCalled();});
 it('cursor continues past the first page instead of starving older bindings',async()=>{const f=fixture(memberId);f.db.identityLink.findMany.mockResolvedValueOnce(Array.from({length:20},(_,i)=>({...binding,identityLinkId:`binding-${i}`}))).mockResolvedValueOnce([]);expect(await f.reconciler.batch()).toMatchObject({scanComplete:false});expect(await f.reconciler.batch()).toMatchObject({scanComplete:true});expect(f.db.identityLink.findMany.mock.calls[1][0]).toMatchObject({cursor:{identityLinkId:'binding-19'},skip:1});});
});
describe('LINE default API safety',()=>{
 function api(initialDefault:string|null=null){
  let currentDefault=initialDefault,userMenu:string|null=null;
  const request=jest.fn(async(url:any,options:any)=>{
   const path=new URL(url).pathname.replace('/v2/bot','');
   if(path==='/info')return Response.json({basicId:'@258vmvsa'});
   if(path==='/user/all/richmenu')return currentDefault?Response.json({richMenuId:currentDefault}):new Response('',{status:404});
   if(path===`/user/all/richmenu/${defaultId}`){currentDefault=defaultId;return Response.json({});}
   if(path.startsWith('/richmenu/'))return Response.json({});
   if(path===`/user/${uid}/richmenu`)return userMenu?Response.json({richMenuId:userMenu}):new Response('',{status:404});
   if(path===`/user/${uid}/richmenu/${memberId}`){userMenu=memberId;return Response.json({});}
   return new Response('',{status:400});
  });
  return {request,client:new LineRichMenuClient({token:'test-token',basicId:'@258vmvsa',defaultMenuId:defaultId,memberMenuId:memberId},request as any)};
 }
 it('creates the default fallback for all friends and reads it back',async()=>{const f=api();await f.client.ready();expect(f.request.mock.calls.map(c=>new URL(c[0]).pathname)).toContain(`/v2/bot/user/all/richmenu/${defaultId}`);expect(await f.client.getUserMenu(uid)).toBeNull();});
 it('does not overwrite an already correct default',async()=>{const f=api(defaultId);await f.client.ready();expect(f.request.mock.calls.filter(c=>c[1].method==='POST')).toHaveLength(0);});
 it('checks menu and artwork before linking a replacement',async()=>{const f=api(defaultId);await f.client.ready();await f.client.link(uid,memberId);const paths=f.request.mock.calls.map(c=>new URL(c[0]).pathname);expect(paths.indexOf(`/v2/bot/richmenu/${memberId}/content`)).toBeLessThan(paths.indexOf(`/v2/bot/user/${uid}/richmenu/${memberId}`));});
 it('does not treat access denied as a missing per-user link',async()=>{const f=api();f.request.mockResolvedValueOnce(new Response('',{status:403}));await expect(f.client.getUserMenu(uid)).rejects.toMatchObject({status:403});});
 it('guards the exact OA before any mutation',async()=>{const f=api();f.request.mockResolvedValueOnce(Response.json({basicId:'@wrong'}));await expect(f.client.ready()).rejects.toMatchObject({status:409});expect(f.request).toHaveBeenCalledTimes(1);});
 it('strips transport errors so credentials cannot enter logs',async()=>{const f=api();f.request.mockRejectedValueOnce(new Error('Authorization: test-token'));await expect(f.client.ready()).rejects.toThrow('LINE_RICH_MENU_HTTP_0');});
});
describe('LINE follow event scheduling',()=>{
 it('wakes reconciliation using hashed metadata without making membership changes',async()=>{
  const hash=createHash('sha256').update(uid).digest('hex'),followHashes=jest.fn().mockResolvedValue(undefined),updateMany=jest.fn().mockResolvedValue({count:1});
  const handler=createLineMessagingObserverHandler({lineMessagingEvent:{findMany:jest.fn().mockResolvedValue([{sourceSubjectHash:hash}]),updateMany}} as any,{followHashes});
  const lease={domain:'IDENTITY',provider:'LINE_MESSAGING',connectionId:'LINE_MESSAGING_DEFAULT',providerWebhookInboxId:'inbox'} as any;
  expect(await handler.process(lease)).toBe('SUCCESS');expect(followHashes).toHaveBeenCalledWith([hash]);expect(JSON.stringify(followHashes.mock.calls)).not.toContain(uid);
 });
});
