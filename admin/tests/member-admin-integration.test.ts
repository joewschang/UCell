import {readFileSync} from 'node:fs';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {command,get,clearAdminToken} from '../src/lib/api';
import type {Order,ProductReference} from '../src/types/domain';

function bundle(){return JSON.parse(readFileSync(process.env.MEMBER_ADMIN_CONTRACT_FILE??new URL('../../governance/member-admin-integration/final/member-admin-contract.json',import.meta.url),'utf8'));}
beforeEach(()=>{vi.stubGlobal('sessionStorage',{getItem:(key:string)=>key==='ucell_admin_token'?'TEST_ONLY_ADMIN_TOKEN':null,removeItem:vi.fn()});vi.stubGlobal('window',{dispatchEvent:vi.fn()});clearAdminToken();});
afterEach(()=>{clearAdminToken();vi.unstubAllGlobals();});

it('actual Admin API reads the Member checkout with the same order, ball and historical Core total',async()=>{
  const b=bundle();expect(b.operationalCredentialsVerified).toBe(false);
  const fetch=vi.fn(async(_url:string,_init:RequestInit)=>new Response(JSON.stringify(b.adminOrderAfter)));vi.stubGlobal('fetch',fetch);
  const response=await get<{data:Order}>(`/admin/orders/${b.orderCreate.data.id}`);
  expect([response.data.orderId,response.data.qualificationId,response.data.netAmount,response.data.status]).toEqual([b.memberOrderAfter.data.id,b.qualificationId,'799.98','PAID']);
  expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer TEST_ONLY_ADMIN_TOKEN');
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(b.adminCatalogAfter)));
  const catalog=await get<{data:ProductReference[]}>('/admin/products');expect(catalog.data.find(p=>p.productId===b.productId)?.currentPrice).toBe('499.99');
});

it('Admin payment transport uses the Core amount and coalesces repeated submission',async()=>{
  const b=bundle();expect(b.paymentConfirmed?.data).toBeTruthy();const fetch=vi.fn(async(_url:string,_init:RequestInit)=>new Response(JSON.stringify(b.paymentConfirmed)));vi.stubGlobal('fetch',fetch);
  const path=`/admin/orders/${b.orderCreate.data.id}/payment-confirmations`;
  const body={amount:b.adminOrderBefore.data.netAmount,paymentMethod:'BANK_TRANSFER',referenceNo:'TEST_ONLY',occurredAt:'2026-09-16T00:00:00Z'};
  const first=command(path,body,'TEST_ONLY_PAYMENT_KEY'),duplicate=command(path,body,'TEST_ONLY_PAYMENT_KEY');expect(duplicate).toBe(first);expect(await first).toEqual(b.paymentConfirmed);
  expect([b.paymentConfirmed.data.orderId,b.paymentConfirmed.data.status]).toEqual([b.orderCreate.data.id,'PAID']);
  expect(fetch).toHaveBeenCalledTimes(1);
  const init=fetch.mock.calls[0][1] as RequestInit;
  expect(JSON.parse(init.body as string)).toEqual(body);expect(body.amount).toBe('799.98');expect(new Headers(init.headers).get('Idempotency-Key')).toBe('TEST_ONLY_PAYMENT_KEY');
});
