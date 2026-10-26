import {BinaryTreeReadService} from '../src/modules/binary-tree/binary-tree-read.service';
const now='2026-10-23T01:00:00.000Z';
const context={timezone:'Asia/Taipei',asOf:now,knowledgeCutoff:now,periodStart:'2026-09-30T16:00:00.000Z',periodEnd:'2026-10-31T16:00:00.000Z'};
beforeEach(()=>jest.spyOn(Date,'now').mockReturnValue(Date.parse(now)));
afterEach(()=>jest.restoreAllMocks());
it('normalizes slight browser clock drift to server time and returns a stable context',()=>{
 const service:any=new BinaryTreeReadService({} as any,{} as any);
 const normalized=service.time({...context,asOf:'2026-10-23T01:00:00.700Z',knowledgeCutoff:'2026-10-23T01:00:00.700Z'});
 expect(normalized).toEqual(context);expect(service.time(normalized)).toEqual(normalized);
});
it('preserves historical times and rejects material future or malformed requests',()=>{
 const service:any=new BinaryTreeReadService({} as any,{} as any);
 const historical={...context,asOf:'2026-10-22T00:00:00.000Z',knowledgeCutoff:'2026-10-22T01:00:00.000Z'};
 expect(service.time(historical)).toEqual(historical);
 expect(()=>service.time({...context,asOf:'2026-10-23T01:00:06.000Z'})).toThrow();
 expect(()=>service.time({...context,knowledgeCutoff:'invalid'})).toThrow();
});
