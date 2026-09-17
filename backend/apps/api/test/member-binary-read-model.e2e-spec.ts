import { unavailableBinaryView } from '../src/modules/member/member-read.service';

describe('Member Binary authoritative read-model boundary',()=>{
 it('keeps current placement counts while failing closed for unavailable monetary and full-tree projections',()=>{
  const view=unavailableBinaryView('qualification-a',[{side:'LEFT',count:'4'},{side:'RIGHT',count:'2'}]);
  expect(view).toEqual({
   qualificationId:'qualification-a',
   left:{count:4,volume:null,carry:null},
   right:{count:2,volume:null,carry:null},
   settlementMetrics:{status:'UNAVAILABLE',reason:'SETTLEMENT_METRICS_READ_MODEL_NOT_AVAILABLE'},
   fullTree:{status:'UNAVAILABLE',reason:'BINARY_TREE_READ_MODEL_NOT_AVAILABLE'},
  });
 });

 it('does not turn absent placement rows into absent monetary evidence',()=>{
  const view=unavailableBinaryView('qualification-b',[]);
  expect(view.left.count).toBe(0);
  expect(view.right.count).toBe(0);
  expect(view.left.volume).toBeNull();
  expect(view.left.carry).toBeNull();
  expect(view.settlementMetrics.status).toBe('UNAVAILABLE');
 });
});
