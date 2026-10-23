import React from 'react';
import {act,create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {it,expect,vi} from 'vitest';
import SharingCenter from '../src/SharingCenter';
vi.mock('../src/memberApi',()=>({memberApi:vi.fn().mockRejectedValue(new Error('成效暫時無法讀取'))}));
vi.mock('../src/ReferralShare',()=>({default:()=> <div>一般會員邀請入口</div>}));
it('keeps all three discovery and invitation entries when insights fail',async()=>{let tree:any;await act(async()=>{tree=create(<MemoryRouter><SharingCenter q={{id:'q',code:'A000001',rank:'STARTER',active:true,ballLabel:'球'}}/></MemoryRouter>)});const links=tree.root.findAllByType('a').map((a:any)=>a.props.href);expect(links).toEqual(expect.arrayContaining(['/shop','/events','/content']));expect(JSON.stringify(tree.toJSON())).toContain('一般會員邀請入口');expect(JSON.stringify(tree.toJSON())).toContain('成效暫時無法讀取');act(()=>tree.unmount())});
