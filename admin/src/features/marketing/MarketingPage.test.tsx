import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import {MarketingPage} from './MarketingPage';
import {command,get} from '../../lib/api';
const auth=vi.hoisted(()=>({role:'SUPER_ADMIN'}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:auth})}));
vi.mock('../../lib/api',()=>({get:vi.fn(),command:vi.fn(),ApiError:class extends Error{status=0;}}));
const row={id:'ball-id',memberNo:'2610000010',ballNo:'AX000010',links:1,visitors:0,boundMembers:0,registrations:0,segment:'REACH',lastSharedAt:null,lastEncouragedAt:null,lastMessage:null,readAt:null};
const data={asOf:new Date().toISOString(),since:new Date().toISOString(),summary:{balls:1,members:1,sharingBalls:1,links:1,visitors:0,boundMembers:0,registrations:0},segments:{REACH:1},rows:[row],total:1,page:1,pageSize:25};
let tree:any;
afterEach(()=>{if(tree)act(()=>tree.unmount());tree=null;vi.clearAllMocks();auth.role='SUPER_ADMIN';});
async function mount(){vi.mocked(get).mockResolvedValue({data});await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><MarketingPage/></MemoryRouter></QueryClientProvider>);await new Promise(r=>setTimeout(r,30));});}
const button=(label:string)=>tree.root.findAllByType('button').find((b:any)=>b.children.includes(label));
it('previews recipient and requires an explicit confirmation; retries retain the key',async()=>{await mount();await act(async()=>button('預覽鼓勵').props.onClick());expect(command).not.toHaveBeenCalled();expect(JSON.stringify(tree.toJSON())).toContain('2610000010');vi.mocked(command).mockRejectedValueOnce(new Error('連線中斷'));await act(async()=>button('確認送出站內鼓勵').props.onClick());expect(JSON.stringify(tree.toJSON())).toContain('連線中斷');const key=vi.mocked(command).mock.calls[0][2];vi.mocked(command).mockResolvedValueOnce({data:{status:'CREATED'}});await act(async()=>button('確認送出站內鼓勵').props.onClick());expect(vi.mocked(command).mock.calls[1][2]).toBe(key);expect(JSON.stringify(tree.toJSON())).toContain('已將鼓勵存入會員');expect(tree.root.findAllByProps({role:'dialog'})).toHaveLength(0);});
it('audit operators only see progress and cannot open the send dialog',async()=>{auth.role='COMPLIANCE_AUDIT';await mount();expect(button('預覽鼓勵')).toBeUndefined();expect(JSON.stringify(tree.toJSON())).toContain('唯讀檢視');});
it('keeps member-based cooldown visible in the table',async()=>{await mount();vi.mocked(get).mockResolvedValue({data:{...data,rows:[{...row,lastEncouragedAt:new Date().toISOString(),lastMessage:'加油'}]}});await act(async()=>{button('更新看板').props.onClick();await new Promise(r=>setTimeout(r,30));});expect(button('七天內已鼓勵').props.disabled).toBe(true);});
