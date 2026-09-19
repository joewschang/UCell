import React from 'react';
import {readFileSync} from 'node:fs';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
import {getProducts,getConnectedOrder,getOrders} from '../src/memberData';
import {ConnectedOrderDetails} from '../src/ConnectedShop';
import {MemoryRouter} from 'react-router-dom';
import {QualificationProvider} from '../src/QualificationContext';
import App from '../src/App';

// Default replays a recorded isolated HTTP bundle. The connected gate supplies
// a newly generated bundle explicitly; neither mode claims live browser UAT.
function bundle(){return JSON.parse(readFileSync(process.env.MEMBER_ADMIN_CONTRACT_FILE??new URL('../../governance/member-admin-integration/final/member-admin-contract.json',import.meta.url),'utf8'));}
let tree:ReactTestRenderer|undefined;
afterEach(()=>{if(tree)act(()=>tree!.unmount());tree=undefined;vi.unstubAllGlobals();});
function serve(response:unknown){vi.stubGlobal('sessionStorage',{getItem:(key:string)=>key==='ucell_member_token'?'TEST_ONLY_MEMBER_TOKEN':null});const fetch=vi.fn(async(_url:string,_init:RequestInit)=>new Response(JSON.stringify(response)));vi.stubGlobal('fetch',fetch);return fetch;}
function qualification(b:any){return {id:b.qualificationId,code:'INTEGRATION000001',rank:'STARTER',active:true,ballLabel:'球1'};}

it('actual Member adapters accept the Admin-configured catalog before and after a price update',async()=>{
  const b=bundle();expect(b.kind).toBe('CONNECTED_DEV_TEST_ONLY');expect(b.operationalCredentialsVerified).toBe(false);
  const fetch=serve(b.memberCatalogBefore);
  const before=await getProducts(new AbortController().signal);
  expect(before.find(p=>p.id===b.productId)?.price).toBe(399.99);
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(b.memberCatalogAfter)));
  expect((await getProducts(new AbortController().signal)).find(p=>p.id===b.productId)?.price).toBe(499.99);
  expect(b.orderCreate.data.total).toBe('799.98');expect(b.checkoutReplay.data.total).toBe('799.98');expect(b.newCheckout.data.total).toBe('999.98');
  expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer TEST_ONLY_MEMBER_TOKEN');
});

it('renders reloaded PAID Core detail after Admin payment without claiming shipment',async()=>{
  const b=bundle(),q=qualification(b);serve(b.memberOrderAfter);
  await act(async()=>{tree=create(<ConnectedOrderDetails q={q} id={b.orderCreate.data.id}/>);});
  const rendered=JSON.stringify(tree!.toJSON());expect(rendered).toContain('PAID');expect(rendered).toContain('799.98');expect(rendered).toContain('不代表付款成功或已出貨');
  serve(b.memberOrdersAfter);const orders=await getOrders(q,new AbortController().signal),paid=orders.orders.find(o=>o.id===b.orderCreate.data.id)!;
  expect([paid.status,paid.paymentStatus,paid.shipmentStatus]).toEqual(['PAID','PAID','FULFILLMENT_PENDING']);
  expect(b.adminOrderAfter.data.status).toBe(paid.status);
});

it('refuses a foreign-ball detail even when the returned order is otherwise valid',async()=>{
  const b=bundle();serve({...b.memberOrderAfter,data:{...b.memberOrderAfter.data,qualificationId:'FOREIGN_BALL'}});
  await expect(getConnectedOrder(qualification(b),b.orderCreate.data.id,new AbortController().signal)).rejects.toThrow('訂單格式或資格不符');
});

it('refreshes the current-ball order list after an Admin payment, replacing stale status',async()=>{
  const b=bundle(),q=qualification(b);expect(b.memberOrdersBefore?.data).toBeTruthy();let paid=false;
  serve(b.memberOrdersBefore);
  const fetch=vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('/qualifications')?{...b.memberOrderAfter,data:[q]}:url.includes('/member/me')?{...b.memberOrderAfter,data:{name:'Integration Member',alias:null,memberNo:'2609000004',email:null,phone:null,gender:null,birthDate:null,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:null}}:paid?b.memberOrdersAfter:b.memberOrdersBefore)));
  vi.stubGlobal('fetch',fetch);
  await act(async()=>{tree=create(<MemoryRouter initialEntries={['/orders']}><QualificationProvider><App/></QualificationProvider></MemoryRouter>);});
  expect(JSON.stringify(tree!.toJSON())).toContain('CONFIRMED');expect(JSON.stringify(tree!.toJSON())).not.toContain('PAID');
  paid=true;
  const refresh=tree!.root.findAllByType('button').find(button=>button.children.join('')==='重新整理訂單');expect(refresh).toBeDefined();
  await act(async()=>{refresh!.props.onClick();});
  const paidCard=tree!.root.findAllByType('article').find(article=>article.findAllByType('p').some(p=>p.children.join('')==='訂單：PAID'))!;
  expect(paidCard).toBeDefined();
  expect(paidCard.findAllByType('p').map(p=>p.children.join(''))).not.toContain('訂單：CONFIRMED');
  expect(JSON.stringify(tree!.toJSON())).not.toContain(b.orderCreate.data.id);
  const reads=fetch.mock.calls.filter(([url])=>url.includes('/member/orders?'));expect(reads).toHaveLength(2);
  expect(reads.every(([url])=>url.includes('qualificationId='+q.id))).toBe(true);
});
