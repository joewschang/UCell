import {it,expect,vi,beforeEach} from 'vitest';
import {create,act} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {QualificationDetail} from './QualificationDetail';
import {get} from '../../lib/api';
vi.mock('../../lib/api',()=>({get:vi.fn(),qs:()=>'?entityType=QUALIFICATION&entityId=ball-a&take=50'}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'MEMBERSHIP_OPS'}})}));
beforeEach(()=>{vi.mocked(get).mockReset();vi.mocked(get).mockImplementation(async(path:string)=>({data:path.includes('/operations')?{qualification:{qualificationId:'ball-a'},pv:[],balances:[],awards:[]}: {qualificationId:'ball-a',currentHolderPersonId:'person-a',planLevelCode:'LEADER',status:'EFFECTIVE',activeFlag:true,activePeriods:[],orders:[]}}) as any)});
async function waitForText(tree:ReturnType<typeof create>,text:string){await vi.waitFor(()=>expect(JSON.stringify(tree.toJSON())).toContain(text))}
async function render(){let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><QualificationDetail id="ball-a"/></QueryClientProvider>)});await waitForText(tree!,'Qualification ID');return tree!}
it('never calls Audit for a Membership Ops user and retains all ten tabs',async()=>{const tree=await render();expect(tree.root.findAllByProps({role:'tab'})).toHaveLength(10);await act(async()=>{tree.root.findAllByProps({role:'tab'}).find(t=>t.children.join('')==='Audit')!.props.onClick()});await waitForText(tree,'此角色無 Audit 讀取權限');expect(vi.mocked(get).mock.calls.every(([p])=>!String(p).includes('audit-events'))).toBe(true);act(()=>tree.unmount())});
it('fails closed for operations belonging to another Qualification',async()=>{vi.mocked(get).mockImplementation(async(path:string)=>({data:path.includes('/operations')?{qualification:{qualificationId:'outsider'},balances:[{pvType:'PV',_sum:{amount:'999999'}}]}:{qualificationId:'ball-a',planLevelCode:'LEADER'}}) as any);const tree=await render();await act(async()=>{tree.root.findAllByProps({role:'tab'}).find(t=>t.children.join('')==='PV/RPV/EPV')!.props.onClick()});await waitForText(tree,'evidence 不一致');expect(JSON.stringify(tree.toJSON())).not.toContain('999999');act(()=>tree.unmount())});
