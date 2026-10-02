import {expect,it} from 'vitest';
import {parsePayouts} from '../src/MemberPayouts';
const date='2026-10-01T00:00:00.000Z';
const page=()=>({qualificationNo:'123',total:1,offset:0,nextOffset:null,asOf:date,items:[{reference:'PAYMENT_RESULT-'+'a'.repeat(40),status:'PAID',paidAmount:'99999999999999.0001',netAmount:'99999999999999.0001',grossAmount:'99999999999999.0001',recoveryOffset:'0',occurredAt:date,recordedAt:date,periodStart:date,periodEnd:date,batchStatus:'PARTIALLY_PAID'}]});
it('preserves exact decimal strings and separates stored report from batch state',()=>{const p=page();expect(parsePayouts(p).items[0].paidAmount).toBe('99999999999999.0001');expect(parsePayouts(p).items[0].batchStatus).toBe('PARTIALLY_PAID');});
it('rejects unknown status, private identifiers and incoherent next-page offsets',()=>{for(const mutate of [(p:ReturnType<typeof page>)=>p.items[0].status='UNKNOWN',(p:ReturnType<typeof page>)=>p.items[0].reference='00000000-0000-4000-8000-000000000001',(p:ReturnType<typeof page>)=>p.items[0].paidAmount='NaN']){const p=page();mutate(p);expect(()=>parsePayouts(p)).toThrow('格式異常');}expect(()=>parsePayouts({...page(),nextOffset:2})).toThrow('格式異常');});

it('accepts persisted VOIDED batches without inventing a cancelled payment state',()=>{const p=page();p.items[0].batchStatus='VOIDED';expect(parsePayouts(p).items[0].batchStatus).toBe('VOIDED');p.items[0].batchStatus='CANCELLED';expect(()=>parsePayouts(p)).toThrow('格式異常');});
