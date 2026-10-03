import React from 'react';
import {act,create,ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import Mall from '../src/Mall';
let tree:ReactTestRenderer;
afterEach(()=>{act(()=>tree?.unmount());vi.unstubAllGlobals();});
const envelope=(data:unknown)=>({ok:true,status:200,json:async()=>({data,meta:{api_version:'v1',request_id:'entry-journey',timestamp:'2026-10-03T00:00:00Z'}})});
function Location(){return <output aria-label="目前頁面">{useLocation().pathname}</output>;}
it.each([[3,'啟航',14400],[9,'菁英',43200],[15,'領袖',72000]])('selects exactly %i mixed/repeated products, pays once and continues the application',async(count,name,price)=>{
 vi.stubGlobal('sessionStorage',{getItem:()=>null});let paid=false;
 const offer={packageVersionId:'11111111-1111-4111-8111-111111111111',packageCode:'STARTER',displayName:name+'會員資格套組',packageClass:'QUALIFICATION',version:4,currency:'TWD',priceAmount:String(price),selectableProductQuantity:count,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_ELIGIBILITY',qualificationEffect:'CREATE_QUALIFICATION',activeDurationUnit:null,activeDurationValue:null,targetQualificationRequired:false,effectiveFrom:'2026-10-03T00:00:00Z',effectiveTo:null,configHash:'a'.repeat(64)};
 const skus=['TIP-363','TIP-580','TIP-696','TIP-777','TIP-999'];
 const products=skus.map((sku,i)=>({productRuleProfileId:`22222222-2222-4222-8222-22222222222${i}`,productId:`33333333-3333-4333-8333-33333333333${i}`,sku,displayName:sku,available:true,minQty:1,maxQty:count,selectionIncrement:1,sortOrder:i}));
 const fetch=vi.fn(async(url:string,init:RequestInit={})=>{
  if(url.includes('/package-payments/')){paid=true;return envelope({status:'PAID'});}
  if(url.endsWith('/formal-enrollment'))return envelope({membershipState:paid?'FORMAL_PENDING':'NETWORK_MEMBER',stagePaymentEnabled:true,paidPackages:paid?[{orderId:'ORDER',packageName:offer.displayName}]:[],feeReceipt:null});
  if(url.includes('legal-entities'))return envelope([]);
  if(url.endsWith('/delivery-profile'))return envelope({recipientName:'TEST',phone:'0900000000',countryCode:'TW',postalCode:'100',region:'TEST',city:'TEST',address:'TEST ONLY ROAD',complete:true,updatedAt:null});
  if(url.endsWith('/products'))return envelope({package:offer,products});
  if(init.method==='POST')return envelope({id:'55555555-5555-4555-8555-555555555555',qualificationId:'44444444-4444-4444-8444-444444444444',status:'CONFIRMED',total:String(price),paymentStatus:'PENDING',shipmentStatus:'FULFILLMENT_PENDING',createdAt:'2026-10-03T00:00:00Z',replayed:false,lines:[]});
  return envelope([offer]);
 });vi.stubGlobal('fetch',fetch);
 await act(async()=>{tree=create(<MemoryRouter initialEntries={['/shop']}><Mall onCreated={vi.fn()}/><Location/></MemoryRouter>)});
 await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('選擇套組商品'))!.props.onClick());
 const checkout=()=>tree.root.findAllByType('button').find(b=>b.children.includes('選購套組並完成 Stage 付款'))!;
 expect(checkout().props.disabled).toBe(true);
 for(let i=0;i<count;i++)act(()=>tree.root.findAllByType('button').filter(b=>b.children.includes('增加'))[i%5].props.onClick());
 expect(tree.root.findAllByType('button').filter(b=>b.children.includes('增加')).every(b=>b.props.disabled)).toBe(true);
 expect(checkout().props.disabled).toBe(false);
 await act(async()=>checkout().props.onClick());
 expect(tree.root.findAllByType('output').find(o=>o.props['aria-label']==='目前頁面')!.children).toEqual(['/membership/upgrade']);
 const writes=fetch.mock.calls.filter(([,init])=>init?.method==='POST');expect(writes).toHaveLength(2);
 const body=JSON.parse(writes[0][1].body as string);expect(body.selections.reduce((n:number,p:any)=>n+p.quantity,0)).toBe(count);
 expect(body).not.toHaveProperty('price');expect(writes[1][0]).toContain('/package-payments/');
 expect((writes[0][1].headers as Headers).get('Idempotency-Key')).toBe((writes[1][1].headers as Headers).get('Idempotency-Key'));
});
