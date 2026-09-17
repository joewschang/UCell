import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createPackageOrder,createQualificationPackageOrder,getActiveDurationPackages,getPackageProducts,getQualificationPackages} from '../src/memberData';

const packageVersionId='11111111-1111-4111-8111-111111111111';
const productRuleProfileId='22222222-2222-4222-8222-222222222222';
const productId='33333333-3333-4333-8333-333333333333';
const qualificationId='44444444-4444-4444-8444-444444444444';
const orderId='55555555-5555-4555-8555-555555555555';
const offer={packageVersionId,packageCode:'QUALIFICATION-STARTER',displayName:'正式會員啟用套組',packageClass:'QUALIFICATION',version:1,currency:'TWD',priceAmount:'4800',selectableProductQuantity:2,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE',activeDurationUnit:null,activeDurationValue:null,targetQualificationRequired:false,effectiveFrom:'2026-09-17T00:00:00.000Z',effectiveTo:null,configHash:'a'.repeat(64)};
const product={productRuleProfileId,productId,sku:'SKU-001',displayName:'套組商品',available:true,minQty:1,maxQty:2,selectionIncrement:1,sortOrder:1};
const envelope=(data:unknown)=>({ok:true,status:200,json:async()=>({data,meta:{api_version:'v1',request_id:'package-contract-test',timestamp:'2026-09-17T00:00:00.000Z'}})});

beforeEach(()=>vi.stubGlobal('sessionStorage',{getItem:()=>null}));
afterEach(()=>vi.unstubAllGlobals());

it('loads qualification packages from the canonical member endpoint',async()=>{
 const fetch=vi.fn(async()=>envelope([offer]));vi.stubGlobal('fetch',fetch);
 await expect(getQualificationPackages(new AbortController().signal)).resolves.toEqual([offer]);
 expect(fetch.mock.calls[0][0]).toContain('/member/packages?class=QUALIFICATION');
});

it('validates the authoritative package product pool and rejects duplicate profiles',async()=>{
 const fetch=vi.fn(async()=>envelope({package:offer,products:[product]}));vi.stubGlobal('fetch',fetch);
 await expect(getPackageProducts(packageVersionId,new AbortController().signal)).resolves.toEqual({package:offer,products:[product]});
 fetch.mockResolvedValueOnce(envelope({package:offer,products:[product,product]}));
 await expect(getPackageProducts(packageVersionId,new AbortController().signal)).rejects.toThrow('套組商品格式異常');
});

it('creates a qualification package order without sending monetary or qualification fields',async()=>{
 const response={qualificationId,id:orderId,status:'CONFIRMED',total:'4800',paymentStatus:'PENDING',shipmentStatus:'PENDING',createdAt:'2026-09-17T01:00:00.000Z',replayed:false,lines:[]};
 const fetch=vi.fn(async()=>envelope(response));vi.stubGlobal('fetch',fetch);
 await expect(createQualificationPackageOrder(packageVersionId,[{productRuleProfileId,quantity:2}],'package-key')).resolves.toEqual(response);
 const [,init]=fetch.mock.calls[0];
 expect(JSON.parse(init.body as string)).toEqual({packageVersionId,selections:[{productRuleProfileId,quantity:2}]});
 expect((init.headers as Headers).get('Idempotency-Key')).toBe('package-key');
 expect(init.method).toBe('POST');
});

it('fails closed on malformed package evidence and duplicate selections',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>envelope([{...offer,configHash:'TEST_ONLY'}])));
 await expect(getQualificationPackages(new AbortController().signal)).rejects.toThrow('套組資料格式異常');
 await expect(createQualificationPackageOrder(packageVersionId,[{productRuleProfileId,quantity:1},{productRuleProfileId,quantity:1}],'package-key')).rejects.toThrow('套組選擇資料格式異常');
});

it('binds active-duration checkout to the explicit owned Qualification',async()=>{
 const activeOffer={...offer,packageClass:'ACTIVE_DURATION',activeDurationUnit:'MONTH',activeDurationValue:1,targetQualificationRequired:true,qualificationEffect:'ACTIVE_ENTITLEMENT'},response={qualificationId,id:orderId,status:'CONFIRMED',total:'4800',paymentStatus:'PENDING',shipmentStatus:'PENDING',createdAt:'2026-09-17T01:00:00.000Z',replayed:false,lines:[]};let call=0;
 const fetch=vi.fn(async(_url:string,init:RequestInit={})=>envelope(call++===0?[activeOffer]:response));vi.stubGlobal('fetch',fetch);
 await expect(getActiveDurationPackages(new AbortController().signal)).resolves.toEqual([activeOffer]);await expect(createPackageOrder(packageVersionId,[{productRuleProfileId,quantity:2}],'duration-key',qualificationId)).resolves.toEqual(response);
 expect(JSON.parse(fetch.mock.calls[1][1].body as string)).toEqual({packageVersionId,targetQualificationId:qualificationId,selections:[{productRuleProfileId,quantity:2}]});
});

it('fails closed when an active-duration order is returned for another Ball',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>envelope({qualificationId:'66666666-6666-4666-8666-666666666666',id:orderId,status:'CONFIRMED',total:'4800',paymentStatus:'PENDING',shipmentStatus:'PENDING',createdAt:'2026-09-17T01:00:00.000Z',replayed:false,lines:[]})));
 await expect(createPackageOrder(packageVersionId,[{productRuleProfileId,quantity:2}],'duration-key',qualificationId)).rejects.toThrow('套組訂單回應異常');
});
