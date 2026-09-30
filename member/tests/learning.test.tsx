import {act,create,ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import LearningCenter,{safeLearningUrl} from '../src/LearningCenter';
import {memberApi} from '../src/memberApi';
vi.mock('../src/memberApi',()=>({memberApi:vi.fn()}));
let tree:ReactTestRenderer;
afterEach(()=>{if(tree)act(()=>tree.unmount());vi.clearAllMocks();});
const detail={courseCode:'TEST_COURSE',title:'原版教材',summary:'說明',version:1,courseStatus:'PUBLISHED',available:true,status:'ENROLLED',requiredLessonCount:1,completedRequiredCount:0,canComplete:false,completedAt:null,lessons:[{sequenceNo:1,title:'必修文章',contentType:'ARTICLE',contentReference:'<script>不可執行</script>',required:true,completedAt:null}]};
async function mount(){await act(async()=>{tree=create(<MemoryRouter initialEntries={['/learning?course=TEST_COURSE']}><LearningCenter/></MemoryRouter>);});}
const button=(label:string)=>tree.root.findAllByType('button').find(row=>row.children.join('')===label)!;
it('shows pinned content safely and enables completion only from server progress',async()=>{
 let completed=false;vi.mocked(memberApi).mockImplementation(async(_path,init)=>{if(init?.method==='POST'){completed=true;return {} as any;}return {...detail,completedRequiredCount:completed?1:0,canComplete:completed,lessons:detail.lessons.map(l=>({...l,completedAt:completed?'2026-10-01T00:00:00Z':null}))} as any;});
 await mount();expect(button('完成課程')).toBeUndefined();expect(tree.root.findAllByType('script')).toHaveLength(0);expect(JSON.stringify(tree.toJSON())).toContain('第 ');
 await act(async()=>button('標記「必修文章」已完成').props.onClick());expect(button('完成課程')).toBeTruthy();expect(memberApi).toHaveBeenCalledWith('/member/learning/courses/TEST_COURSE/lessons/1/complete',expect.objectContaining({method:'POST',headers:{'Idempotency-Key':expect.any(String)}}));
});
it('preserves the command key after an ambiguous failure and hides writes for archived history',async()=>{
 let failure=true;vi.mocked(memberApi).mockImplementation(async(_path,init)=>{if(init?.method==='POST'){if(failure)throw Error('暫時無法連線');return {} as any;}return detail as any;});await mount();await act(async()=>button('標記「必修文章」已完成').props.onClick());failure=false;await act(async()=>button('標記「必修文章」已完成').props.onClick());const writes=vi.mocked(memberApi).mock.calls.filter(([,init])=>init?.method==='POST');expect(writes[0][1]?.headers).toEqual(writes[1][1]?.headers);
 act(()=>tree.unmount());vi.mocked(memberApi).mockResolvedValue({...detail,courseStatus:'ARCHIVED',available:false});await mount();expect(button('標記「必修文章」已完成')).toBeUndefined();expect(JSON.stringify(tree.toJSON())).toContain('歷史學習紀錄');
});
it('rejects script, insecure and credential-bearing content URLs',()=>{for(const value of ['javascript:alert(1)','http://example.test','https://user:password@example.test','//example.test'])expect(safeLearningUrl(value)).toBeNull();expect(safeLearningUrl('https://example.test/course.pdf')).toBe('https://example.test/course.pdf');});
