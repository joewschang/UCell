import React from 'react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { act,create } from 'react-test-renderer';
import { beforeEach,expect,it,vi } from 'vitest';
import { get } from '../../lib/api';
import { SubscriptionsPage } from './SubscriptionsPage';

vi.mock('../../lib/api',()=>({
  get:vi.fn(),
  qs:(values:Record<string,string|number|undefined|null>)=>{
    const query=new URLSearchParams();
    Object.entries(values).forEach(([key,value])=>{if(value!==undefined&&value!==null&&String(value)!=='')query.set(key,String(value));});
    const rendered=query.toString();return rendered?`?${rendered}`:'';
  },
}));

const internalQualificationId='550e8400-e29b-41d4-a716-446655440000';
const qualification={ballNo:'TREE-A000001',currentHolder:{memberNo:'2609000001'}};
const row={subscriptionId:'subscription-1',qualificationId:internalQualificationId,qualification,plan:{planCode:'YEAR'},status:'ACTIVE',startMonth:'2026-09',endMonth:'2027-08'};

beforeEach(()=>{
  vi.mocked(get).mockReset().mockImplementation(async(path:string)=>{
    if(path==='/admin/subscriptions/plans')return {data:[]};
    if(path==='/admin/subscriptions/subscription-1')return {data:{...row,schedules:[]}};
    if(path.startsWith('/admin/subscriptions'))return {data:[row]};
    throw Error(`Unexpected path ${path}`);
  });
});

async function render(){
  let view:ReturnType<typeof create>;
  await act(async()=>{view=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><SubscriptionsPage/></QueryClientProvider>);});
  await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain('TREE-A000001'));
  return view!;
}

it('sends a canonical Ball Number filter and never renders a Qualification UUID',async()=>{
  const view=await render();
  const input=view.root.findByProps({placeholder:'例如 TREE-A000001'});
  await act(async()=>input.props.onChange({target:{value:'tree-a000001'}}));
  await vi.waitFor(()=>expect(vi.mocked(get)).toHaveBeenCalledWith('/admin/subscriptions?ballNo=TREE-A000001&take=100'));
  const rowButton=view.root.findAllByType('button').find(button=>button.findAllByType('strong').some(label=>label.children.join('')==='YEAR · ACTIVE'))!;
  await act(async()=>rowButton.props.onClick());
  await vi.waitFor(()=>expect(view.root.findAllByType('p').some(item=>item.children.join('')==='Ball Number：TREE-A000001')).toBe(true));
  const output=JSON.stringify(view.toJSON());
  expect(view.root.findAllByType('p').some(item=>item.children.join('')==='會員編號：2609000001')).toBe(true);
  expect(output).not.toContain(internalQualificationId);
  expect(output).not.toContain('Qualification：');
  act(()=>view.unmount());
});
