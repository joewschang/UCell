import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from '../src/App';
import {QualificationProvider} from '../src/QualificationContext';

let tree:ReactTestRenderer|undefined;
const response=(data:unknown)=>new Response(JSON.stringify({data,meta:{request_id:'conditional-journey',api_version:'v1',timestamp:'2026-09-18T00:00:00.000Z'}}));
const offer={packageVersionId:'11111111-1111-4111-8111-111111111111',packageCode:'QUALIFICATION-STARTER',displayName:'正式會員啟用套組',packageClass:'QUALIFICATION',version:1,currency:'TWD',priceAmount:'4800',selectableProductQuantity:2,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',activeDurationUnit:null,activeDurationValue:null,targetQualificationRequired:false,effectiveFrom:'2026-09-17T00:00:00.000Z',effectiveTo:null,configHash:'a'.repeat(64)};
const incompleteDelivery={recipientName:null,phone:null,countryCode:null,postalCode:null,region:null,city:null,address:null,complete:false,updatedAt:null};
const person={name:'LINE 使用者',alias:null,memberNo:'2609000003',email:null,phone:null,gender:null,birthDate:null,membershipState:null,mobileVerifiedAt:null};
const contract={id:'contract-1',type:'NETWORK_MEMBERSHIP',version:'V1',title:'網路會員合約',content:'測試合約內容',contentHash:'a'.repeat(64),required:true,effectiveFrom:'2026-01-01T00:00:00Z',effectiveTo:null,acceptedAt:null};

beforeEach(()=>vi.stubGlobal('sessionStorage',{getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn()}));
afterEach(()=>{if(tree)act(()=>tree!.unmount());tree=undefined;vi.unstubAllGlobals();vi.restoreAllMocks();});

async function mount(path:string){await act(async()=>{tree=create(<MemoryRouter initialEntries={[path]}><QualificationProvider><App/></QualificationProvider></MemoryRouter>);});}

describe('conditional member journeys',()=>{
 it('offers the first-Qualification package route without issuing Qualification-scoped reads',async()=>{
  const fetch=vi.fn(async(input:string)=>{
   if(input.includes('/member/qualifications'))return response([]);
   if(input.includes('/member/delivery-profile'))return response(incompleteDelivery);
   if(input.includes('/member/packages?class=QUALIFICATION'))return response([offer]);
   throw Error(`unexpected request: ${input}`);
  });
  vi.stubGlobal('fetch',fetch);
  await mount('/shop');
  const rendered=JSON.stringify(tree!.toJSON());
  expect(rendered).toContain('取得第一個會員資格');
  expect(rendered).toContain('正式會員啟用套組');
  expect(rendered).toContain('套組價格：');
  expect(rendered).toContain('TWD');
  expect(rendered).toContain('4800');
  const gated=tree!.root.findAllByType('button').find(node=>node.children.join('')==='請先完成配送資料');
  expect(gated?.props.disabled).toBe(true);
  expect(fetch.mock.calls.every(([url])=>!url.includes('qualificationId'))).toBe(true);
  expect(fetch.mock.calls.every(([,init])=>(init?.method??'GET')==='GET')).toBe(true);
 });

 it('shows network registration for an authenticated Person without a Qualification and does not infer one',async()=>{
  const fetch=vi.fn(async(input:string)=>{
   if(input.includes('/member/qualifications'))return response([]);
   if(input.includes('/member/contracts/required'))return response([contract]);
   if(input.includes('/member/me'))return response(person);
   throw Error(`unexpected request: ${input}`);
  });
  vi.stubGlobal('fetch',fetch);
  await mount('/me');
  const rendered=JSON.stringify(tree!.toJSON());
  expect(rendered).toContain('尚未完成網路會員註冊');
  expect(rendered).toContain('完成網路會員註冊');
  expect(rendered).toContain('本流程不會建立經營資格或球位');
  expect(rendered).not.toContain('升級正式會員：加密草稿');
  expect(fetch.mock.calls.every(([url])=>!url.includes('qualificationId'))).toBe(true);
  expect(fetch.mock.calls.every(([,init])=>(init?.method??'GET')==='GET')).toBe(true);
 });
});
