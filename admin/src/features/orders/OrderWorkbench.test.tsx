import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create,type ReactTestInstance,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import {command,get} from '../../lib/api';
import {OrdersWorkbench,useOrderRoute} from './OrderWorkbench';

vi.mock('../../lib/api',async original=>({...await original<typeof import('../../lib/api')>(),get:vi.fn(),command:vi.fn()}));
function TestPage({role}:{role:string}){
  const route=useOrderRoute();
  return <OrdersWorkbench route={route} role={role} busy={false}><p>已開啟訂單 {route.id}</p></OrdersWorkbench>;
}
let view:ReactTestRenderer;
let client:QueryClient;
afterEach(()=>{if(view)act(()=>view.unmount());client?.clear();vi.resetAllMocks();});
function allText(n:ReactTestInstance):string{return n.children.map(c=>typeof c==='string'?c:allText(c)).join('');}
function button(name:string){return view.root.findAllByType('button').find(n=>allText(n)===name)!;}
async function mount(role:string,url='/orders?new=1'){
  client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  await act(async()=>{view=create(<MemoryRouter initialEntries={[url]}><QueryClientProvider client={client}><TestPage role={role}/></QueryClientProvider></MemoryRouter>);});
}
it('reuses the same create command key and reviewed payload after an uncertain response, including fractional quantities',async()=>{
  vi.mocked(get).mockImplementation(async path=>path.includes('qualification-options')?{data:[{qualificationId:'test-ball',ballNo:'TEST-01',currentHolder:{legalName:'範例會員'}}],meta:{hasNext:false}}:
    path.includes('product-options')?{data:[{productId:'product',sku:'QA-01',displayName:'範例商品',currentPrice:'100'}]}:{data:[]});
  vi.mocked(command).mockRejectedValueOnce(new Error('暫時無法連線')).mockResolvedValue({data:{orderId:'created-order'}});
  await mount('ORDER_OPS');
  await vi.waitFor(()=>expect(button('範例會員 · TEST-01')).toBeDefined());
  act(()=>button('範例會員 · TEST-01').props.onClick());
  act(()=>button('下一步，選商品').props.onClick());
  await vi.waitFor(()=>expect(view.root.findAllByType('option').some(n=>n.props.value==='product')).toBe(true));
  act(()=>view.root.findByType('select').props.onChange({target:{value:'product'}}));
  const input=()=>view.root.findByProps({'aria-label':'範例商品 數量'});
  act(()=>input().props.onChange({target:{value:'0'}}));
  expect(button('下一步，核對訂單').props.disabled).toBe(true);
  act(()=>input().props.onChange({target:{value:'2.25'}}));
  expect(allText(view.root)).toContain('預估訂單總額TWD 225.00');
  act(()=>button('下一步，核對訂單').props.onClick());
  expect(allText(view.root)).toContain('單價 TWD 100.00 × 2.25小計TWD 225.00');
  expect(allText(view.root)).toContain('預估訂單總額TWD 225.00');
  await act(async()=>button('確認建立訂單').props.onClick());
  await vi.waitFor(()=>expect(button('重試建立訂單')).toBeDefined());
  await act(async()=>button('重試建立訂單').props.onClick());
  const [first,second]=vi.mocked(command).mock.calls;
  expect(first[0]).toBe('/admin/orders');
  expect(first[1]).toEqual({qualificationId:'test-ball',purpose:'RETAIL',items:[{productId:'product',quantity:'2.25'}]});
  expect(first[2]).toMatch(/^[0-9a-f-]{36}$/);expect(second).toEqual(first);
  await vi.waitFor(()=>expect(allText(view.root)).toContain('已開啟訂單 created-order'));
});
it('rounds each displayed line and the unrounded aggregate separately like the order ledger',async()=>{
  const products=['A','B'].map(id=>({productId:id,sku:id,displayName:'商品'+id,currentPrice:'2.01',currency:'TWD'}));
  vi.mocked(get).mockImplementation(async path=>path.includes('qualification-options')?{data:[{qualificationId:'q',ballNo:'T-01',currentHolder:{legalName:'會員'}}]}:{data:products});
  await mount('FINANCE');
  await vi.waitFor(()=>expect(button('會員 · T-01')).toBeDefined());
  act(()=>button('會員 · T-01').props.onClick());
  act(()=>button('下一步，選商品').props.onClick());
  await vi.waitFor(()=>expect(view.root.findAllByType('option').some(n=>n.props.value==='A')).toBe(true));
  for(const p of products){
    act(()=>view.root.findByType('select').props.onChange({target:{value:p.productId}}));
    act(()=>view.root.findByProps({'aria-label':p.displayName+' 數量'}).props.onChange({target:{value:'0.5'}}));
  }
  act(()=>button('下一步，核對訂單').props.onClick());
  expect(allText(view.root).match(/小計TWD 1\.01/g)).toHaveLength(2);
  expect(allText(view.root)).toContain('預估訂單總額TWD 2.01');
});
it('keeps audit accounts out of create even with a direct link',async()=>{
  await mount('COMPLIANCE_AUDIT');
  expect(allText(view.root)).toContain('此帳號可查閱訂單');
  expect(button('下一步，選商品')).toBeUndefined();expect(get).not.toHaveBeenCalled();expect(command).not.toHaveBeenCalled();
});
