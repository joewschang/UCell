import {describe,expect,it} from 'vitest';
import {parseWebRetailOrders} from '../src/memberData';
const row={orderNo:'202610010001',status:'CONFIRMED',total:'10000000000000.0001',createdAt:'2026-10-01T00:00:00Z',confirmedAt:null,itemCount:1,itemNames:['零售商品']};
describe('stored retail-order projection',()=>{
 it('preserves exact money and drops fields outside the public view',()=>{
  const parsed=parseWebRetailOrders([{...row,personId:'private-person',qualificationId:'private-qualification',paymentReference:'private-bank'}]);
  expect(parsed).toEqual([row]);expect(parsed[0].total).toBe('10000000000000.0001');expect(parsed[0].itemNames).not.toBe(row.itemNames);
 });
 it.each([{total:10000000000000.0001},{orderNo:202610010001},{itemCount:-1},{itemCount:1.5},{status:'INVENTED'},{createdAt:0},{confirmedAt:undefined},{total:'NaN'}])('rejects inconsistent source data %j',bad=>expect(()=>parseWebRetailOrders([{...row,...bad}])).toThrow('零售訂單歷程格式異常'));
 it('rejects duplicated business identities instead of rendering ambiguous rows',()=>expect(()=>parseWebRetailOrders([row,row])).toThrow());
 it('keeps a genuine empty history empty',()=>expect(parseWebRetailOrders([])).toEqual([]));
});
