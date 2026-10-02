import {reconcilePhysicalLines} from '../src/modules/commerce/fulfillment-erp-reconciliation.service';

describe('physical ERP reconciliation',()=>{
 const expected=[{sku:'TIP-363',quantity:'1',serialNos:['A0010001']},{sku:'TIP-363',quantity:'1',serialNos:['A0010002']},{sku:'TIP-999',quantity:'1',serialNos:['B0010001']}];
 it('aggregates repeated SKU lines and ignores order without losing serial identity',()=>{
  expect(reconcilePhysicalLines(expected,[expected[2],{sku:'TIP-363',quantity:'2.0',serialNos:['A0010002','A0010001']}]).outcome).toBe('MATCHED');
 });
 it('treats an exact subset as partial and detects duplicate or wrong serials',()=>{
  expect(reconcilePhysicalLines(expected,[expected[0]]).outcome).toBe('PARTIAL');
  expect(reconcilePhysicalLines(expected,[expected[0],expected[0],expected[2]])).toMatchObject({outcome:'MISMATCH',reasonCode:'ERP_SERIAL_MISMATCH'});
  expect(reconcilePhysicalLines(expected,[{...expected[0],serialNos:['B0010001']}]).outcome).toBe('MISMATCH');
 });
 it('rejects unknown SKU, excess quantity and inconsistent serial count',()=>{
  for(const actual of [{...expected[0],sku:'UNKNOWN'},{...expected[0],quantity:'3'},{...expected[0],serialNos:[]}])expect(reconcilePhysicalLines(expected,[actual]).outcome).toBe('MISMATCH');
 });
 it('rejects malformed physical quantities before persistence',()=>{
  for(const quantity of ['-1','0.5','1e3','NaN','9007199254740992'])expect(()=>reconcilePhysicalLines(expected,[{...expected[0],quantity}])).toThrow();
 });
});
