import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {LearningPage} from './LearningPage';
import {get,post} from '../../lib/api';
import {canOpen} from '../auth/permissions';
vi.mock('../../lib/api',()=>({get:vi.fn(),post:vi.fn()}));
it('requires publication evidence and archive reason and preserves the command key when retrying',async()=>{
 vi.mocked(get).mockResolvedValue({data:[{courseCode:'TEST_COURSE',status:'DRAFT',enrollmentCount:0,versions:[{version:1,title:'課程',status:'DRAFT',categoryCode:'ONBOARDING',lessons:[]}]}]});vi.mocked(post).mockRejectedValueOnce(Error('連線中斷')).mockResolvedValue({data:{}});
 let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><LearningPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,40));});
 const buttons=()=>tree.root.findAllByType('button');expect(buttons().find((b:any)=>b.children.includes('核准發布')).props.disabled).toBe(true);expect(buttons().find((b:any)=>b.children.includes('封存課程')).props.disabled).toBe(true);
 const input=tree.root.findAllByType('input').find((i:any)=>i.props.maxLength===200);await act(async()=>input.props.onChange({target:{value:'APPROVED-TEST'}}));const form=tree.root.findAllByType('form')[1];await act(async()=>form.props.onSubmit({preventDefault(){}}));await act(async()=>form.props.onSubmit({preventDefault(){}}));expect(post).toHaveBeenCalledTimes(2);expect(vi.mocked(post).mock.calls[0][2]?.idempotencyKey).toBe(vi.mocked(post).mock.calls[1][2]?.idempotencyKey);expect(post).toHaveBeenLastCalledWith('/admin/learning/courses/TEST_COURSE/publish',{approvalReference:'APPROVED-TEST'},expect.anything());await act(async()=>tree.unmount());
 expect(canOpen('MEMBERSHIP_OPS','/learning')).toBe(true);expect(canOpen('FINANCE','/learning')).toBe(false);
});
