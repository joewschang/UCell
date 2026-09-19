import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemberApiError} from '../src/api';
import MemberBinaryTree from '../src/MemberBinaryTree';
import type {MemberTreePage} from '../src/memberData';

const treeRead=vi.hoisted(()=>vi.fn());

vi.mock('../src/memberData',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/memberData')>();
 return {...actual,getMemberTree:treeRead};
});

const q={id:'q1',code:'A000001',rank:'LEADER',active:true,ballLabel:'球 A000001'};
const page=(snapshotToken:string,items:MemberTreePage['items'],nextCursor:string|null):MemberTreePage=>({
 status:'AVAILABLE',snapshotToken,snapshotExpiresAt:'2099-01-01T00:00:00.000Z',parentBallNo:q.code,hiddenBootstrapBoundary:false,items,nextCursor,
});
let tree:ReactTestRenderer|undefined;
const button=(label:string)=>tree!.root.findAllByType('button').find(node=>node.children.join('')===label);

beforeEach(()=>{
 treeRead.mockReset();
 treeRead
  .mockResolvedValueOnce(page('snapshot-1',[{ballNo:'A000005',binaryPositionNo:'8',side:'LEFT',nodeKind:'AnonymousBallNode'}],'cursor-2'))
  .mockRejectedValueOnce(new MemberApiError('snapshot expired',409,'TREE_SNAPSHOT_EXPIRED'))
  .mockResolvedValueOnce(page('snapshot-2',[{ballNo:'A000006',binaryPositionNo:'9',side:'RIGHT',nodeKind:'AnonymousBallNode'}],null));
});
afterEach(()=>{if(tree)act(()=>tree!.unmount());tree=undefined;vi.clearAllMocks();});

it('clears a 409 tree snapshot and waits for an explicit new-snapshot action',async()=>{
 await act(async()=>{tree=create(<MemberBinaryTree q={q}/>);await Promise.resolve();});
 expect(JSON.stringify(tree!.toJSON())).toContain('A000005');

 await act(async()=>{button('載入更多節點')!.props.onClick();await Promise.resolve();await Promise.resolve();});
 const expired=JSON.stringify(tree!.toJSON());
 expect(expired).toContain('組織快照已失效');
 expect(expired).toContain('重新整理並建立新的快照');
 expect(expired).not.toContain('A000005');
 expect(button('重新載入')).toBeUndefined();
 expect(treeRead).toHaveBeenCalledTimes(2);

 await act(async()=>{button('重新整理並建立新的快照')!.props.onClick();await Promise.resolve();await Promise.resolve();});
 expect(treeRead).toHaveBeenCalledTimes(3);
 expect(treeRead.mock.calls[2][1]).toBeUndefined();
 expect(treeRead.mock.calls[2][2]).toBeUndefined();
 expect(treeRead.mock.calls[2][4]).toBeUndefined();
 expect(JSON.stringify(tree!.toJSON())).toContain('A000006');
});
