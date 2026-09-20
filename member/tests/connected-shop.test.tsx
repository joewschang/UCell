import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {it,expect,vi,afterEach} from 'vitest';
import ConnectedShop from '../src/ConnectedShop';
let tree:ReactTestRenderer;
const q={id:'qa',code:'BALL1',rank:'STARTER',active:true,ballLabel:'球1'};
const order={qualificationId:'qa',id:'order1',status:'CONFIRMED',total:'399',createdAt:'2026-09-16T00:00:00Z',lines:[{productId:'p1',name:'Core product',quantity:'1',amount:'399'}]};
const delivery={recipientName:'Test Member',phone:'+886223456789',countryCode:'TW',postalCode:'100',region:'Taipei',city:'Zhongzheng',address:'Test Road 1',complete:true,updatedAt:'2026-09-17T00:00:00Z'};
const envelope=(data:unknown)=>({ok:true,status:200,json:async()=>({data,meta:{api_version:'v1',request_id:'shop-test',timestamp:'2026-09-16T00:00:00Z'}})});
afterEach(()=>{if(tree)act(()=>tree.unmount());vi.unstubAllGlobals();});
const button=(label:string)=>tree.root.findAllByType('button').find(b=>b.children.join('')===label)!;
async function mount(){vi.stubGlobal('sessionStorage',{getItem:()=>null});await act(async()=>{tree=create(<MemoryRouter><ConnectedShop q={q}/></MemoryRouter>);});}
it('uses Core order amount and requests authorized detail; submits no price or PV',async()=>{
 const fetch=vi.fn(async(url:string,init:RequestInit)=>url.endsWith('/delivery-profile')?envelope(delivery):url.endsWith('/products')?envelope([{id:'p1',name:'Core product',price:999999,pv:null,available:true}]):envelope(order));vi.stubGlobal('fetch',fetch);
 await mount();act(()=>button('加入購物車').props.onClick());act(()=>button('前往結帳').props.onClick());await act(async()=>{await button('使用此配送資料建立待付款訂單').props.onClick();});
 const post=fetch.mock.calls.find(([,init])=>init.method==='POST')!;
 expect(JSON.parse(post[1].body as string)).toEqual({qualificationId:'qa',items:[{productId:'p1',quantity:'1'}]});
 expect((post[1].headers as Headers).get('Idempotency-Key')).toBeTruthy();
 expect(fetch.mock.calls.some(([url])=>url.includes('/orders/order1?qualificationId=qa'))).toBe(true);
 expect(JSON.stringify(tree.toJSON())).toContain('399');expect(JSON.stringify(tree.toJSON())).toContain('待付款訂單已建立');
});
it('preserves cart and key through a retryable 409 without assuming order success',async()=>{
 let posts=0;const fetch=vi.fn(async(url:string,init:RequestInit)=>{
  if(url.endsWith('/delivery-profile'))return envelope(delivery);if(url.endsWith('/products'))return envelope([{id:'p1',name:'Core product',price:399,pv:null,available:true}]);
  if(init.method==='POST'&&posts++===0)return {ok:false,status:409,json:async()=>({code:'RETRYABLE_CONFLICT'})};
  return envelope(order);
 });vi.stubGlobal('fetch',fetch);await mount();act(()=>button('加入購物車').props.onClick());act(()=>button('前往結帳').props.onClick());
 await act(async()=>{await button('使用此配送資料建立待付款訂單').props.onClick();});expect(JSON.stringify(tree.toJSON())).toContain('保留原資料重試');
 expect(JSON.stringify(tree.toJSON())).not.toContain('待付款訂單已建立');
 await act(async()=>{await button('使用此配送資料建立待付款訂單').props.onClick();});const calls=fetch.mock.calls.filter(([,init])=>init.method==='POST');
 expect(calls).toHaveLength(2);expect(calls[0][1].body).toBe(calls[1][1].body);expect((calls[0][1].headers as Headers).get('Idempotency-Key')).toBe((calls[1][1].headers as Headers).get('Idempotency-Key'));
});
it('renders a real empty catalog and disables checkout',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('/delivery-profile')?envelope(delivery):envelope([])));await mount();expect(JSON.stringify(tree.toJSON())).toContain('目前沒有可訂購商品');expect(button('前往結帳').props.disabled).toBe(true);
});
it.each([
 [403,'QUALIFICATION_NOT_OWNED','您無權查看此資格資料'],
 [422,'RULE_PROFILE_CONFIGURATION_PENDING','商品制度設定尚未完成']
])('renders %s checkout error without inventing an order or losing cart',async(status,code,message)=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('/delivery-profile')?envelope(delivery):url.endsWith('/products')?envelope([{id:'p1',name:'Core product',price:399,pv:null,available:true}]):{ok:false,status,json:async()=>({code})}));
 await mount();act(()=>button('加入購物車').props.onClick());act(()=>button('前往結帳').props.onClick());await act(async()=>{await button('使用此配送資料建立待付款訂單').props.onClick();});
 expect(JSON.stringify(tree.toJSON())).toContain(message);expect(JSON.stringify(tree.toJSON())).not.toContain('待付款訂單已建立');expect(button('使用此配送資料建立待付款訂單').props.disabled).toBe(false);
});
it('keeps checkout disabled until the authoritative delivery profile is complete',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('/delivery-profile')?envelope({recipientName:null,phone:null,countryCode:null,postalCode:null,region:null,city:null,address:null,complete:false,updatedAt:null}):envelope([{id:'p1',name:'Core product',price:399,pv:null,available:true}])));await mount();act(()=>button('加入購物車').props.onClick());expect(button('前往結帳').props.disabled).toBe(false);act(()=>button('前往結帳').props.onClick());expect(JSON.stringify(tree.toJSON())).toContain('結帳前請完成配送資料');
});
