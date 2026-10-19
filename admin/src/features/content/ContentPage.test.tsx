import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {ContentPage} from './ContentPage';
import {get,command} from '../../lib/api';
vi.mock('../../lib/api',()=>({get:vi.fn(),command:vi.fn()}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'SUPER_ADMIN'}})}));
it('defaults to member-only and requires an explicit public selection before creating a public draft',async()=>{
 vi.mocked(get).mockResolvedValue({data:[]});vi.mocked(command).mockResolvedValue({});
 let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ContentPage/></QueryClientProvider>)});
 const audience=tree.root.findAllByType('select').find((s:any)=>s.findAllByType('option').some((o:any)=>o.props.value==='PUBLIC'));
 expect(audience.props.value).toBe('NETWORK_MEMBER');
 await act(async()=>{audience.props.onChange({target:{value:'PUBLIC'}});tree.root.findAllByType('input').find((i:any)=>i.props.maxLength===160).props.onChange({target:{value:'公開影片'}});tree.root.findAllByType('input').find((i:any)=>i.props.type==='url').props.onChange({target:{value:'https://example.com/video'}})});
 expect(JSON.stringify(tree.toJSON())).toContain('所有訪客可見');
 await act(async()=>tree.root.findAllByType('button').find((b:any)=>b.children.includes('建立草稿')).props.onClick());
 expect(command).toHaveBeenCalledWith('/admin/content',expect.objectContaining({audiencePolicy:'PUBLIC',title:'公開影片'}));
 expect(vi.mocked(command).mock.calls.every(([url])=>!String(url).includes('/publish'))).toBe(true);
 await act(async()=>tree.unmount());
});
