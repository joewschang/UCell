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
  if(url.includes('/onboarding/sponsor/candidate'))return envelope({kind:'BALL',sponsorBallNo:'A000001',planLevelCode:'STARTER',effectiveAt:'2026-01-01T00:00:00Z',ruleVersion:'R1.0B'});
  if(url.endsWith('/package-quote'))return envelope({packageVersionId:offer.packageVersionId,originalAmount:offer.priceAmount,goodsAmount:offer.priceAmount,discountAmount:'0',qualificationFee:offer.packageClass==='QUALIFICATION'?'600':'0',total:String(Number(offer.priceAmount)+(offer.packageClass==='QUALIFICATION'?600:0)),selectableProductQuantity:offer.selectableProductQuantity,couponCode:null,quoteHash:'a'.repeat(64)});
  if(url.includes('legal-entities'))return envelope([]);
  if(url.endsWith('/delivery-profile'))return envelope(completeDelivery);
  if(url.includes('/member/packages/')&&url.endsWith('/products'))return envelope({package:offer,products:[product]});
  if(init.method==='POST')return envelope({qualificationId:'44444444-4444-4444-8444-444444444444',id:'55555555-5555-4555-8555-555555555555',status:'CONFIRMED',total:'4800',paymentStatus:'PENDING',shipmentStatus:'FULFILLMENT_PENDING',createdAt:'2026-09-17T01:00:00.000Z',replayed:false,lines:[]});
  return envelope([offer]);
 });vi.stubGlobal('fetch',fetch);
 await act(async()=>{tree=create(<QualificationPackageShop onCreated={onCreated}/>);});
 await act(async()=>{button('選擇套組商品').props.onClick();});
 await act(async()=>tree.root.findByProps({'aria-label':'推薦會員資格編號（球號，必填）'}).props.onChange({target:{value:'A000001'}}));
 act(()=>button('增加').props.onClick());act(()=>button('增加').props.onClick());
 await act(async()=>{button('確認商品與費用 →').props.onClick();});await act(async()=>{await button('確認建立待付款訂單').props.onClick();});
 const post=fetch.mock.calls.find(([url,init])=>init?.method==='POST'&&!url.endsWith('/package-quote'))!;
 expect(JSON.parse(post[1].body as string)).toEqual({packageVersionId,sponsorCode:'A000001',selections:[{productRuleProfileId,quantity:2}],quoteHash:'a'.repeat(64)});
 expect(JSON.stringify(post[1].body)).not.toMatch(/price|pv|bv|qualificationId/i);
 expect((post[1].headers as Headers).get('Idempotency-Key')).toBeTruthy();
 const rendered=JSON.stringify(tree.toJSON());expect(rendered).toContain('訂單已建立，等待付款確認');expect(rendered).toContain('4800');expect(onCreated).toHaveBeenCalledOnce();
});

it('allows selecting products first but blocks checkout until delivery data is complete',async()=>{
 const fetch=vi.fn(async(url:string)=>url.endsWith('/package-quote')?envelope({packageVersionId:offer.packageVersionId,originalAmount:offer.priceAmount,goodsAmount:offer.priceAmount,discountAmount:'0',qualificationFee:offer.packageClass==='QUALIFICATION'?'600':'0',total:String(Number(offer.priceAmount)+(offer.packageClass==='QUALIFICATION'?600:0)),selectableProductQuantity:offer.selectableProductQuantity,couponCode:null,quoteHash:'a'.repeat(64)}):url.includes('legal-entities')?envelope([]):url.endsWith('/delivery-profile')?envelope({...completeDelivery,recipientName:null,complete:false}):url.endsWith('/products')?envelope({package:offer,products:[product]}):envelope([offer]));vi.stubGlobal('fetch',fetch);
 await act(async()=>{tree=create(<QualificationPackageShop onCreated={()=>undefined}/>);});
 expect(button('選擇套組商品').props.disabled).toBe(false);
 expect(fetch.mock.calls.some(([url])=>url.includes('/products'))).toBe(false);
 await act(async()=>button('選擇套組商品').props.onClick());
 expect(button('確認商品與費用 →').props.disabled).toBe(true);
});

it('uses the configured icon in a compact product row and retains quantity selection',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('/package-quote')?envelope({packageVersionId:offer.packageVersionId,originalAmount:offer.priceAmount,goodsAmount:offer.priceAmount,discountAmount:'0',qualificationFee:offer.packageClass==='QUALIFICATION'?'600':'0',total:String(Number(offer.priceAmount)+(offer.packageClass==='QUALIFICATION'?600:0)),selectableProductQuantity:offer.selectableProductQuantity,couponCode:null,quoteHash:'a'.repeat(64)}):url.includes('legal-entities')?envelope([]):url.endsWith('/delivery-profile')?envelope(completeDelivery):url.endsWith('/products')?envelope({package:offer,products:[{...product,iconUrl:'/products/tip-363.png'}]}):envelope([offer])));
 await act(async()=>{tree=create(<QualificationPackageShop onCreated={()=>undefined}/>);});
 await act(async()=>button('選擇套組商品').props.onClick());
 const image=tree.root.findByType('img');expect(image.props.src).toBe('/products/tip-363.png');expect(image.props.width).toBe('48');expect(image.props.className).toBe('package-product-icon');
 expect(tree.root.findAllByProps({className:'mall-product-cover'})).toHaveLength(0);
 act(()=>button('增加').props.onClick());expect(tree.root.findByType('output').children).toEqual(['1']);
});

it('applies the zero-box coupon, skips delivery and requires a fresh quote after edits',async()=>{
 const promoOffer={...offer,packageCode:'STARTER',priceAmount:'14400',selectableProductQuantity:3};
 const fetch=vi.fn(async(url:string,init:RequestInit={})=>{
  if(url.includes('/onboarding/sponsor/candidate'))return envelope({kind:'BALL',sponsorBallNo:'A000001',planLevelCode:'STARTER',effectiveAt:'2026-01-01T00:00:00Z',ruleVersion:'R1.0B'});
  if(url.endsWith('/package-quote')){const code=JSON.parse(String(init.body)).couponCode;return envelope({packageVersionId,originalAmount:'14400',discountAmount:code?'14400':'0',goodsAmount:code?'0':'14400',qualificationFee:'600',total:code?'600':'15000',selectableProductQuantity:code?0:3,couponCode:code??null,quoteHash:'a'.repeat(64),endsAt:'2027-01-31T16:00:00Z',description:'優惠主商品減少3盒'});}
  if(url.includes('legal-entities'))return envelope([]);
  if(url.endsWith('/formal-enrollment'))return envelope({stagePaymentEnabled:false});
  if(url.endsWith('/delivery-profile'))return envelope({...completeDelivery,complete:false});
  if(url.endsWith('/products'))return envelope({package:promoOffer,products:[product]});
  if(url.endsWith('/orders')&&init.method==='POST')return envelope({id:'55555555-5555-4555-8555-555555555555',qualificationId:'44444444-4444-4444-8444-444444444444',status:'CONFIRMED',total:'600',paymentStatus:'PENDING',shipmentStatus:'FULFILLMENT_PENDING',createdAt:new Date().toISOString(),replayed:false,lines:[]});
  return envelope([promoOffer]);
 });vi.stubGlobal('fetch',fetch);await act(async()=>{tree=create(<QualificationPackageShop onCreated={vi.fn()}/>)});await act(async()=>button('選擇套組商品').props.onClick());
 const input=()=>tree.root.findAllByType('input').find(n=>n.props.placeholder==='輸入優惠碼')!;
 act(()=>input().props.onChange({target:{value:'ucell888'}}));expect(button('確認商品與費用 →').props.disabled).toBe(true);
 await act(async()=>tree.root.findByProps({'aria-label':'推薦會員資格編號（球號，必填）'}).props.onChange({target:{value:'A000001'}}));
 await act(async()=>button('套用優惠碼').props.onClick());expect(JSON.stringify(tree.toJSON())).toContain('無需選購或填寫配送資料');expect(button('確認商品與費用 →').props.disabled).toBe(false);
 act(()=>input().props.onChange({target:{value:'WRONG'}}));expect(button('確認商品與費用 →').props.disabled).toBe(true);
 act(()=>input().props.onChange({target:{value:'UCELL888'}}));await act(async()=>button('確認商品與費用 →').props.onClick());await act(async()=>button('確認建立待付款訂單').props.onClick());
 const posted=fetch.mock.calls.find(([url,init])=>url.endsWith('/orders')&&init?.method==='POST')!;expect(JSON.parse(String(posted[1].body))).toMatchObject({couponCode:'UCELL888',selections:[],quoteHash:'a'.repeat(64)});expect(JSON.stringify(tree.toJSON())).toContain('等待付款確認');
});
