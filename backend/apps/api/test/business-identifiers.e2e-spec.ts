import {ballNoFor,bootstrapBallNoFor,binaryParent,binaryPath,binarySide,childPosition} from '@ucell/database';
import {memberSafeAnonymousNode} from '../src/modules/member/member-read.service';
import {isDescendantOrSelf,memberSafeTreeNode} from '../src/modules/member/member-tree-read.service';

describe('P0 business identifiers',()=>{
 it('uses an unbounded, exact binary heap identity and derives the canonical path',()=>{
  expect(binaryPath(1n)).toBe('R');
  expect(binaryPath(2n)).toBe('RL');
  expect(binaryPath(3n)).toBe('RR');
  expect(binaryPath(5n)).toBe('RLR');
  const deep=(1n<<62n)+17n;
  expect(binaryParent(deep)).toBe(deep/2n);
  expect(binarySide(deep)).toBe(deep%2n===0n?'LEFT':'RIGHT');
  expect(childPosition(3n,'LEFT')).toBe(6n);
  expect(childPosition(3n,'RIGHT')).toBe(7n);
 });
 it('derives Company bootstrap and member Ball numbers without a six-position ceiling',()=>{
  expect(bootstrapBallNoFor('A',1n)).toBe('AX000001');
  expect(bootstrapBallNoFor('A',2n)).toBe('AX000002');
  expect(bootstrapBallNoFor('A',3n)).toBe('AX000003');
  expect(ballNoFor('A',1n)).toBe('A000001');
  expect(ballNoFor('A',1000000n)).toBe('A1000000');
 });
 it('keeps binary paths separate from ordinary sequence formatting',()=>{
  const expected=['AX000001','AX000002','AX000003','A000001','A000002','A000003','A000004','A000005','A000006','A000007','A000008','A000009','A000010','A000011','A000012'];
  const paths=['R','RL','RR','RLL','RLR','RRL','RRR','RLLL','RLLR','RLRL','RLRR','RRLL','RRLR','RRRL','RRRR'];
  for(let n=1;n<=15;n++){expect(n<=3?bootstrapBallNoFor('A',BigInt(n)):ballNoFor('A',BigInt(n-3))).toBe(expected[n-1]);expect(binaryPath(BigInt(n))).toBe(paths[n-1]);}
 });
 it('round-trips parent, side and children through normal and precision-safe deep positions',()=>{
  for(const position of [1n,2n,3n,4n,5n,6n,7n,8n,9n,10n,11n,12n,13n,14n,15n,(1n<<60n)+12345n]){
   expect(childPosition(position,'LEFT')).toBe(position*2n);
   expect(childPosition(position,'RIGHT')).toBe(position*2n+1n);
   if(position>1n){expect(binaryParent(position)).toBe(position/2n);expect(binarySide(position)).toBe(position%2n===0n?'LEFT':'RIGHT');}
   expect(binaryPath(position)).toMatch(/^R[LR]*$/);
  }
 });
 it('formats allocated sequences without subtracting bootstrap positions',()=>{
  // These inputs are allocated sequences, not binary positions.
  expect(ballNoFor('A',6n)).toBe('A000006');
  expect(ballNoFor('A',4n)).toBe('A000004');
 });
 it('serializes anonymous Member nodes without nullable or hidden holder PII fields',()=>{
  const topology=memberSafeTreeNode({ballNo:'A000050',binaryPositionNo:50n,side:'LEFT'});
  const referral=memberSafeAnonymousNode({ballNo:'A000050'});
  expect(topology).toEqual({ballNo:'A000050',binaryPositionNo:'50',side:'LEFT',nodeKind:'AnonymousBallNode'});
  expect(referral).toEqual({code:'A000050',name:'',nodeKind:'AnonymousBallNode'});
  for(const payload of [topology,referral])for(const forbidden of ['legalName','preferredName','memberNo','mobile','email','lineId','personId','qualificationId','reservoir'])expect(payload).not.toHaveProperty(forbidden);
 });
 it('permits Member tree expansion only inside the owned binary-position subtree',()=>{
  expect(isDescendantOrSelf(4n,4n)).toBe(true);
  expect(isDescendantOrSelf(18n,4n)).toBe(true);
  expect(isDescendantOrSelf(5n,4n)).toBe(false);
  expect(isDescendantOrSelf(3n,4n)).toBe(false);
 });
});
