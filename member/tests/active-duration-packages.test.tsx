import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import ActiveDurationPackages from '../src/ActiveDurationPackages';

let tree:ReactTestRenderer;
const qualificationId='44444444-4444-4444-8444-444444444444',packageVersionId='11111111-1111-4111-8111-111111111111',productRuleProfileId='22222222-2222-4222-8222-222222222222';
const q={id:qualificationId,code:'BALL-1',rank:'STARTER',active:true,ballLabel:'球 1'};
const offer={packageVersionId,packageCode:'ACTIVE-ONE-MONTH',displayName:'資格有效期套組',packageClass:'ACTIVE_DURATION',version:1,currency:'TWD',priceAmount:'1200',selectableProductQuantity:1,selectionMode:'EXACT_QUANTITY',membershipEffect:'NONE',qualificationEffect:'ACTIVE_ENTITLEMENT',activeDurationUnit:'MONTH',activeDurationValue:1,targetQualificationRequired:true,effectiveFrom:'2026-09-17T00:00:00.000Z',effectiveTo:null,configHash:'a'.repeat(64)};
const product={productRuleProfileId,productId:'33333333-3333-4333-8333-333333333333',sku:'SKU-1',displayName:'有效期商品',available:true,minQty:1,maxQty:1,selectionIncrement:1,sortOrder:1};
const envelope=(data:unknown)=>({ok:true,status:200,json:async()=>({data,meta:{api_version:'v1',request_id:'active-duration-test',timestamp:'2026-09-17T00:00:00.000Z'}})});
const button=(label:string)=>tree.root.findAllByType('button').find(item=>item.children.join('')===label)!;

beforeEach(()=>vi.stubGlobal('sessionStorage',{getItem:()=>null}));
afterEach(()=>{if(tree)act(()=>tree.unmount());vi.unstubAllGlobals();});

it('binds the selected Ball to an active-duration package order',async()=>{
 const fetch=vi.fn(async(url:string,init:RequestInit={})=>url.includes('class=ACTIVE_DURATION')?envelope([offer]):url.endsWith('/products')?envelope({package:offer,products:[product]}):envelope({qualificationId,id:'55555555-5555-4555-8555-555555555555',status:'CONFIRMED',total:'1200',paymentStatus:'PENDING',shipmentStatus:'FULFILLMENT_PENDING',createdAt:'2026-09-17T01:00:00.000Z',replayed:false,lines:[]}));vi.stubGlobal('fetch',fetch);
 await act(async()=>{tree=create(<ActiveDurationPackages q={q} onCreated={()=>undefined}/>);});await act(async()=>{button('選擇有效期套組商品').props.onClick();});act(()=>button('增加').props.onClick());await act(async()=>{await button('建立待付款套組訂單').props.onClick();});
 const post=fetch.mock.calls.find(([,init])=>init.method==='POST')!;expect(JSON.parse(post[1].body as string)).toEqual({packageVersionId,targetQualificationId:qualificationId,selections:[{productRuleProfileId,quantity:1}]});expect(JSON.stringify(tree.toJSON())).toContain('目標資格');expect(JSON.stringify(tree.toJSON())).toContain(qualificationId);
});
