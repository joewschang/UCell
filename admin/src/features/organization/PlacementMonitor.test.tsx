import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {it,expect,vi} from 'vitest';
import {get} from '../../lib/api';
import {PlacementMonitor} from './PlacementMonitor';
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'SUPER_ADMIN'}})}));
vi.mock('../../lib/api',()=>({get:vi.fn(),qs:(v:Record<string,string>)=>'?'+new URLSearchParams(Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined))).toString()}));
it('shows monitoring counts and carries the public ball into placement navigation',async()=>{
 vi.mocked(get).mockResolvedValue({data:{items:[{ballNo:'A000002',memberNo:'2610000011',sponsorBallNo:'A000001',treeId:'tree',status:'PLACEMENT_OVERDUE'}],total:1,nextCursor:null,counts:{pending:0,overdue:1,placed:4},observedAt:new Date().toISOString()}});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});let view!:ReactTestRenderer;
 await act(async()=>{view=create(<QueryClientProvider client={client}><MemoryRouter><PlacementMonitor/></MemoryRouter></QueryClientProvider>);await new Promise(r=>setTimeout(r,20))});
 expect(JSON.stringify(view.toJSON())).toContain('A000002');expect(view.root.findByType('a').props.href).toContain('candidateBallNo=A000002');
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('').startsWith('已完成'))!.props.onClick());expect(get).toHaveBeenLastCalledWith(expect.stringContaining('status=PLACED'));act(()=>view.unmount());client.clear();
});
