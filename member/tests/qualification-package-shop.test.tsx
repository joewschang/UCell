import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import QualificationPackageShop from '../src/QualificationPackageShop';

let tree:ReactTestRenderer;
const packageVersionId='11111111-1111-4111-8111-111111111111',productRuleProfileId='22222222-2222-4222-8222-222222222222',productId='33333333-3333-4333-8333-333333333333';
const offer={packageVersionId,packageCode:'QUALIFICATION-STARTER',displayName:'正式會員啟用套組',packageClass:'QUALIFICATION',version:1,currency:'TWD',priceAmount:'4800',selectableProductQuantity:2,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',activeDurationUnit:null,activeDurationValue:null,targetQualificationRequired:false,effectiveFrom:'2026-09-17T00:00:00.000Z',effectiveTo:null,configHash:'a'.repeat(64)};
const product={productRuleProfileId,productId,sku:'SKU-001',displayName:'套組商品',available:true,minQty:1,maxQty:2,selectionIncrement:1,sortOrder:1};
const completeDelivery={recipientName:'Test Member',phone:'+886223456789',countryCode:'TW',postalCode:'100',region:'Taipei',city:'Zhongzheng',address:'Test Road 1',complete:true,updatedAt:'2026-09-17T00:00:00.000Z'};
const envelope=(data:unknown)=>({ok:true,status:200,json:async()=>({data,meta:{api_version:'v1',request_id:'package-shop-test',timestamp:'2026-09-17T00:00:00.000Z'}})});
const button=(label:string)=>tree.root.findAllByType('button').find(item=>item.children.join('')===label)!;

beforeEach(()=>vi.stubGlobal('sessionStorage',{getItem:()=>null}));
afterEach(()=>{if(tree)act(()=>tree.unmount());vi.unstubAllGlobals();});

it('creates the first-qualification order from exact product selections without client monetary fields',async()=>{
 const onCreated=vi.fn(),fetch=vi.fn(async(url:string,init:RequestInit={})=>{
  if(url.endsWith('/delivery-profile'))return envelope(completeDelivery);
  if(url.includes('/member/packages/')&&url.endsWith('/products'))return envelope({package:offer,products:[product]});
  if(init.method==='POST')return envelope({qualificationId:'44444444-4444-4444-8444-444444444444',id:'55555555-5555-4555-8555-555555555555',status:'CONFIRMED',total:'4800',paymentStatus:'PENDING',shipmentStatus:'FULFILLMENT_PENDING',createdAt:'2026-09-17T01:00:00.000Z',replayed:false,lines:[]});
  return envelope([offer]);
 });vi.stubGlobal('fetch',fetch);
 await act(async()=>{tree=create(<QualificationPackageShop onCreated={onCreated}/>);});
 await act(async()=>{button('選擇套組商品').props.onClick();});
 act(()=>button('增加').props.onClick());act(()=>button('增加').props.onClick());
 await act(async()=>{await button('建立待付款套組訂單').props.onClick();});
 const post=fetch.mock.calls.find(([,init])=>init?.method==='POST')!;
 expect(JSON.parse(post[1].body as string)).toEqual({packageVersionId,selections:[{productRuleProfileId,quantity:2}]});
 expect(JSON.stringify(post[1].body)).not.toMatch(/price|pv|bv|qualificationId/i);
 expect((post[1].headers as Headers).get('Idempotency-Key')).toBeTruthy();
 const rendered=JSON.stringify(tree.toJSON());expect(rendered).toContain('待付款套組訂單已建立');expect(rendered).toContain('4800');expect(onCreated).toHaveBeenCalledOnce();
});

it('keeps package selection disabled until authoritative delivery data is complete',async()=>{
 const fetch=vi.fn(async(url:string)=>url.endsWith('/delivery-profile')?envelope({...completeDelivery,recipientName:null,complete:false}):envelope([offer]));vi.stubGlobal('fetch',fetch);
 await act(async()=>{tree=create(<QualificationPackageShop onCreated={()=>undefined}/>);});
 expect(button('請先完成配送資料').props.disabled).toBe(true);
 expect(fetch.mock.calls.some(([url])=>url.includes('/products'))).toBe(false);
});
