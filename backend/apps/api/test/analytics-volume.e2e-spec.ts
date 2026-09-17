import {aggregateVolumes,captureCarry,captureVolumeProjection,decimal,units,VolumeFact} from '../src/modules/analytics/analytics.volume';
import {Prisma} from '@ucell/database';
const fact=(patch:Partial<VolumeFact>={}):VolumeFact=>({id:'event',qualificationId:'child',type:'GPV',original:'100.1234',adjustment:'-20.0000',envelope:{evidence:{sponsor:[{childQualificationId:'child',sponsorQualificationId:'root'}],binary:[{childQualificationId:'child',parentQualificationId:'middle',side:'LEFT'},{childQualificationId:'middle',parentQualificationId:'root',side:'RIGHT'}]}} as any,...patch});
describe('Authoritative historical volume report',()=>{
 test('separates trees and sides; adjustments retain the original historical path',()=>{
  const sponsor=aggregateVolumes('root','sponsor',[fact()])[0],binary=aggregateVolumes('root','binary',[fact()])[0];
  expect(sponsor.generations[0].net).toBe('80.1234');expect(sponsor.left).toBeNull();expect(binary.generations[1].net).toBe('80.1234');expect(binary.right?.net).toBe('80.1234');expect(binary.left?.net).toBe('0.0000');
 });
 test('exact four decimals survive large sums; no floating point precision loss',()=>{expect(decimal(units('99999999999999.9999')*2000n)).toBe('199999999999999999.8000');expect(decimal(units('-0.0001')+units('0.0002'))).toBe('0.0001');expect(()=>units('1.00001')).toThrow();});
 test('does not mix GPV, RPV and EPV units',()=>{const result=aggregateVolumes('root','sponsor',[fact(),fact({type:'RPV',original:'10',adjustment:'0'})]);expect(result[0].total.net).toBe('80.1234');expect(result[1].total.net).toBe('10.0000');expect(result[2].total.events).toBe(0);});
 test('includes generation twelve, excludes thirteen and the root',()=>{
  const sponsor=Array.from({length:13},(_,i)=>({childQualificationId:`q${i}`,sponsorQualificationId:`q${i+1}`}));
  const f=fact({qualificationId:'q0',envelope:{evidence:{sponsor,binary:[]}} as any});
  expect(aggregateVolumes('q12','sponsor',[f])[0].generations[11].events).toBe(1);expect(aggregateVolumes('q13','sponsor',[f])[0].total.events).toBe(0);expect(aggregateVolumes('q0','sponsor',[f])[0].total.events).toBe(0);
 });
 test('rejects overlapping ancestry and negative corrected amounts',()=>{
  const f=fact();f.envelope.evidence.sponsor.push({childQualificationId:'child',sponsorQualificationId:'other'});expect(()=>aggregateVolumes('root','sponsor',[f])).toThrow();expect(()=>aggregateVolumes('root','sponsor',[fact({adjustment:'-999'})])).toThrow();
 });
 const row={periodEnd:new Date('2026-09-01'),leftCarryOut:new Prisma.Decimal(20),rightCarryOut:new Prisma.Decimal(10)};
 const tx=(correction:any)=>({binaryCarry:{findMany:jest.fn(async()=>[row])},settlementBatch:{findFirst:jest.fn(async()=>({settlementBatchId:'batch'}))},replayCarryProjection:{findFirst:jest.fn(async()=>correction)}});
 test('latest carry correction wins; no silent fallback when root is missing',async()=>{
  const result=await captureCarry(tx({sequence:7n,carry:{root:{left:'3.5',right:'0'}}}) as any,'root',new Date(),'R1.0B');expect(result).toMatchObject({left:'3.5000',right:'0.0000',originalLeft:'20.0000',basis:'LATEST_REPLAY_CORRECTION',correctionSequence:'7'});
  expect(await captureCarry(tx({sequence:8n,carry:{}}) as any,'root',new Date(),'R1.0B')).toMatchObject({status:'UNAVAILABLE',reason:'CARRY_CORRECTION_INCOMPLETE'});
 });
 test('unfinalized carry is unavailable and cannot become a zero balance',async()=>{const t=tx(null);t.settlementBatch.findFirst.mockResolvedValue(null as any);expect(await captureCarry(t as any,'root',new Date(),'R1.0B')).toMatchObject({status:'UNAVAILABLE'});});
 test('source cap fails closed without reading a partial ledger',async()=>{const t={pvLedger:{findMany:jest.fn(async()=>Array(2001).fill({}))}};expect(await captureVolumeProjection(t as any,'root',new Date())).toMatchObject({status:'UNAVAILABLE',reason:'VOLUME_SOURCE_LIMIT',sponsor:null});expect(t.pvLedger.findMany).toHaveBeenCalledTimes(1);});
});
