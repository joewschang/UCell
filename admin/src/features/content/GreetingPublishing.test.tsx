import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {GreetingPublishing} from './GreetingPublishing';
import {get,getBlob,command} from '../../lib/api';
const state=vi.hoisted(()=>({role:'ORDER_OPS'}));
vi.mock('../../lib/api',()=>({get:vi.fn(),getBlob:vi.fn(),command:vi.fn()}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:state.role}})}));
let tree:ReactTestRenderer;
const row={id:'00000000-0000-0000-0000-000000000001',greeting_date:'2026-11-11',title:'待審核問候',status:'DRAFT',publish_at:'2026-11-10T23:00:00Z',image_hash:'a'.repeat(64),approval_reference:null};
beforeEach(()=>{state.role='ORDER_OPS';vi.mocked(get).mockResolvedValue({data:[row]});vi.mocked(getBlob).mockResolvedValue(new Blob(['png'],{type:'image/png'}));vi.mocked(command).mockResolvedValue({});});
afterEach(async()=>{await act(async()=>tree?.unmount());vi.clearAllMocks();});
const render=async()=>{const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});client.setQueryData(['daily-greeting-publications'],{data:[row]});await act(async()=>{tree=create(<QueryClientProvider client={client}><GreetingPublishing/></QueryClientProvider>)});};
it('does not allow publication before preview and explicit approval reference',async()=>{
 await render();const publish=()=>tree.root.findByProps({children:'核准發布此版本'});
 expect(publish().props.disabled).toBe(true);
 await act(async()=>tree.root.findByProps({children:'預覽'}).props.onClick());expect(publish().props.disabled).toBe(true);
 await act(async()=>tree.root.findAllByType('input').find(i=>i.props.maxLength===200)!.props.onChange({target:{value:'APPROVAL-TEST'}}));expect(publish().props.disabled).toBe(false);
 await act(async()=>publish().props.onClick());expect(command).toHaveBeenCalledWith(`/admin/daily-greetings/${row.id}/publish`,{approvalReference:'APPROVAL-TEST'});
});
it('keeps audit-only users read-only',async()=>{
 state.role='COMPLIANCE_AUDIT';await render();expect(tree.root.findAllByType('input')).toHaveLength(0);const actions=tree.root.findAllByType('button').filter(b=>b.props.className!=='admin-time-sort-button');expect(actions.map(b=>b.children.join(''))).toEqual(['預覽']);expect(command).not.toHaveBeenCalled();
});
