import {act,create,ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import EventCenter from '../src/EventCenter';
import {memberApi} from '../src/memberApi';
vi.mock('../src/memberApi',()=>({memberApi:vi.fn()}));
let tree:ReactTestRenderer;
afterEach(()=>{if(tree)act(()=>tree.unmount());vi.clearAllMocks();});
const detail={eventCode:'TEST_EVENT',title:'活動',description:'說明',version:1,eventType:'HYBRID',eventStatus:'PUBLISHED',startsAt:'2026-10-01T01:00:00Z',endsAt:'2026-10-01T03:00:00Z',locationReference:'場地',onlineJoinReference:'https://example.test/event',capacity:10,status:'REGISTERED',canRegister:false,canCancel:true,canIssueCredential:true,history:[{eventType:'EVENT_REGISTERED',occurredAt:'2026-09-30T00:00:00Z',version:1,origin:'REGISTRATION_TRANSITION'}]};
const token='a'.repeat(43),button=(label:string)=>tree.root.findAllByType('button').find(row=>row.children.join('')===label)!;
async function mount(){await act(async()=>{tree=create(<MemoryRouter initialEntries={['/events?event=TEST_EVENT']}><EventCenter/></MemoryRouter>);});}
it('shows an issued credential only in the current owner view and clears it after cancellation',async()=>{
 let cancelled=false;vi.mocked(memberApi).mockImplementation(async(path,init)=>{if(init?.method==='POST'){if(path.endsWith('/cancel')){cancelled=true;return {} as any;}return {checkInToken:token} as any;}return {...detail,...(cancelled?{status:'CANCELLED',canCancel:false,canIssueCredential:false,onlineJoinReference:null}:{})} as any;});
 await mount();expect(JSON.stringify(tree.toJSON())).not.toContain(token);await act(async()=>button('取得報到憑證').props.onClick());expect(tree.root.findByProps({'aria-label':'報到憑證'}).children.join('')).toBe(token);await act(async()=>button('取消報名').props.onClick());expect(tree.root.findAllByProps({'aria-label':'報到憑證'})).toHaveLength(0);expect(JSON.stringify(tree.toJSON())).toContain('已取消');
});
it('keeps retry keys after network failure and removes all commands for archived participation',async()=>{
 let failure=true;vi.mocked(memberApi).mockImplementation(async(_path,init)=>{if(init?.method==='POST'){if(failure)throw Error('連線中斷');return {checkInToken:token} as any;}return detail as any;});await mount();await act(async()=>button('取得報到憑證').props.onClick());failure=false;await act(async()=>button('取得報到憑證').props.onClick());const writes=vi.mocked(memberApi).mock.calls.filter(([,init])=>init?.method==='POST');expect(writes[0][1]?.headers).toEqual(writes[1][1]?.headers);
 act(()=>tree.unmount());vi.mocked(memberApi).mockResolvedValue({...detail,eventStatus:'ARCHIVED',canRegister:false,canCancel:false,canIssueCredential:false,onlineJoinReference:null});await mount();expect(button('取得報到憑證')).toBeUndefined();expect(button('取消報名')).toBeUndefined();expect(tree.root.findAllByType('a')).toHaveLength(0);expect(JSON.stringify(tree.toJSON())).toContain('完成報名');
});
