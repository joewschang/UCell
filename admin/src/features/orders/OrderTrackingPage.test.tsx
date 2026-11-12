import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create,type ReactTestInstance,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {OrderTrackingPage} from './OrderTrackingPage';

vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'FINANCE'}})}));
vi.mock('../../lib/api',async original=>({...await original<typeof import('../../lib/api')>(),get:vi.fn()}));
const text=(node:ReactTestInstance):string=>node.children.map(c=>typeof c==='string'?c:text(c)).join('');
it('shows the attributed member on every order card and leaves missing names explicit',async()=>{
  const orders=['測試會員','測試有限公司',null].map((memberName,i)=>({memberName,orderId:'o'+i,orderNo:String(i+1),displayOrderNo:'SL1234567890'+i,tab:'PAYMENT',total:'100',paymentStatus:'PENDING',createdAt:'2026-11-12T00:00:00Z',items:[],fulfillments:[],reviews:[],recipient:'寄送聯絡人'}));
  vi.mocked(get).mockImplementation(async p=>p.endsWith('/imports')?{data:[]}:{data:{orders,total:3,page:1,pages:1,counts:{ALL:3}}});
  const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
  let view:ReactTestRenderer|undefined;
  try{
    await act(async()=>{view=create(<MemoryRouter><QueryClientProvider client={qc}><OrderTrackingPage/></QueryClientProvider></MemoryRouter>);});
    await vi.waitFor(()=>expect(view!.root.findAllByProps({className:'tracking-member-name'})).toHaveLength(3));
    expect(view!.root.findAllByProps({className:'tracking-member-name'}).map(text)).toEqual(['會員名稱 測試會員','會員名稱 測試有限公司','會員名稱 未提供']);
    expect(text(view!.root)).not.toContain('寄送聯絡人');
    expect(vi.mocked(get).mock.calls.map(([url])=>url)).toHaveLength(2);
  }finally{if(view)act(()=>view!.unmount());qc.clear();vi.resetAllMocks();}
});
