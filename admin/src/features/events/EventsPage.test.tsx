import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {EventsPage} from './EventsPage';
import {get,post} from '../../lib/api';
import {canOpen} from '../auth/permissions';
vi.mock('../../lib/api',()=>({get:vi.fn(),post:vi.fn()}));
it('checks in using a private credential, clears it after success and confirms attendance from the roster',async()=>{
 const event={eventCode:'TEST_EVENT',status:'PUBLISHED',registrationCount:1,versions:[{version:1,title:'Activity',status:'PUBLISHED',startsAt:'2026-10-01T00:00:00Z',endsAt:'2026-10-01T01:00:00Z',capacity:10}]};vi.mocked(get).mockImplementation(async path=>({data:path.endsWith('/registrations')?{eventCode:'TEST_EVENT',registrations:[{memberNo:'1000000001',status:'CHECKED_IN',checkedInAt:'2026-10-01T00:01:00Z',attendedAt:null,history:[{eventType:'EVENT_CHECKED_IN',occurredAt:'2026-10-01T00:01:00Z',version:1}]}]}:[event]}) as any);vi.mocked(post).mockResolvedValue({data:{eventCode:'TEST_EVENT',status:'CHECKED_IN'}});
 let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><EventsPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,40));});
 const input=tree.root.findByProps({type:'password'});await act(async()=>input.props.onChange({target:{value:'a'.repeat(43)}}));await act(async()=>tree.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));expect(post).toHaveBeenCalledWith('/admin/events/check-in',{checkInToken:'a'.repeat(43)},expect.objectContaining({idempotencyKey:expect.any(String)}));expect(tree.root.findByProps({type:'password'}).props.value).toBe('');
 await act(async()=>{tree.root.findAllByType('button').find((b:any)=>b.children.includes('查看報名與出席名冊')).props.onClick();await new Promise(resolve=>setTimeout(resolve,40));});await act(async()=>tree.root.findAllByType('button').find((b:any)=>b.children.includes('確認出席')).props.onClick());expect(post).toHaveBeenLastCalledWith('/admin/events/TEST_EVENT/attend',{memberNo:'1000000001'},expect.anything());await act(async()=>tree.unmount());expect(canOpen('ORDER_OPS','/events')).toBe(true);expect(canOpen('FINANCE','/events')).toBe(false);
});
