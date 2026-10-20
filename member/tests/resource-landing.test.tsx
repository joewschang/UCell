import React from 'react';
import {act,create} from 'react-test-renderer';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const landing=vi.hoisted(()=>vi.fn(async()=>({accepted:true})));
vi.mock('../src/liff',()=>({recordReferralLanding:landing}));
vi.mock('@ucell/design-system',()=>({CompanyLogo:()=> <span>UCell</span>}));
import PublicContentLanding from '../src/PublicContentLanding';
let tree:any;
beforeEach(()=>{vi.stubGlobal('document',{title:''});landing.mockClear();});
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());vi.unstubAllGlobals();});
async function render(resource:any,destination:string){vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({data:{content:null,resource,requiresLogin:false,destination},meta:{api_version:'v1',request_id:'test',timestamp:new Date().toISOString()}})})));await act(async()=>{tree=create(<PublicContentLanding token="signed-token"/>);});return tree;}
it('shows backend product price/image and keeps the SKU through login and registration',async()=>{await render({kind:'PRODUCT',reference:'TIP-363',title:'商品名稱',summary:'介紹',thumbnailUrl:'https://member.ucell.life/products/tip-363.png',price:'4800',currency:'TWD',available:true},'/shop?sku=TIP-363');const links=tree.root.findAllByType('a').map((a:any)=>a.props.href);expect(links).toContain('/shop?sku=TIP-363');expect(links).toContain('/shop?sku=TIP-363&mode=register');expect(JSON.stringify(tree.toJSON())).toContain('4,800');expect(landing).toHaveBeenCalledTimes(1);});
it('explains full activity status without implying reserved admission',async()=>{await render({kind:'EVENT',reference:'EVENT_123',title:'會員活動',summary:'說明',thumbnailUrl:null,eventType:'ONLINE',startsAt:'2026-11-01T00:00:00Z',endsAt:'2026-11-01T02:00:00Z',registrationStatus:'FULL'},'/events?event=EVENT_123');expect(JSON.stringify(tree.toJSON())).toContain('目前名額已滿');expect(JSON.stringify(tree.toJSON())).toContain('分享連結不保留名額');expect(tree.root.findAllByType('a').map((a:any)=>a.props.href)).toContain('/events?event=EVENT_123&mode=register');});
