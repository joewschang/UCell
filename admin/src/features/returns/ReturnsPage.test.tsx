import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,useNavigate,type NavigateFunction} from 'react-router-dom';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {get,command} from '../../lib/api';
import {ReturnsPage} from './ReturnsPage';
import {uiText} from '../../../../shared/design-system/i18n';
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'ORDER_OPS'}})}));
vi.mock('../../lib/api',async importOriginal=>{
 const actual=await importOriginal<typeof import('../../lib/api')>();
 return {...actual,get:vi.fn(),command:vi.fn()};
});
const order={orderId:'11111111-1111-4111-8111-111111111111',orderNo:'123',status:'PAID',netAmount:'2400',
 lines:[{orderLineId:'line-1',productNameSnapshot:'源力飲',remainingReversibleQuantity:'2'}],
};
const event={preventDefault(){}};
beforeEach(()=>{
 vi.mocked(command).mockReset().mockResolvedValue({data:{}});
 vi.mocked(get).mockReset().mockImplementation(async(path:string)=>{
  if(path==='/admin/orders?orderNo=123&take=1')return {data:[order]} as any;
  if(path===`/admin/orders/${order.orderId}`)return {data:order} as any;
  return {data:[]} as any;
 });
});
async function render(path='/returns?orderNo=123'){
 let view:ReturnType<typeof create>,navigate:NavigateFunction;
 function Navigation(){navigate=useNavigate();return null;}
 await act(async()=>{view=create(<MemoryRouter initialEntries={[path]}><Navigation/><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ReturnsPage/></QueryClientProvider></MemoryRouter>);});
 return {view:view!,navigate:navigate!};
}
const createButton=(view:ReturnType<typeof create>)=>view.root.findAllByType('button').find(button=>button.children.join('')===uiText('建立Return Case'))!;

it.each(['123','000123'])('loads exact order %s and rechecks detail before allowing the existing financial return',async number=>{
 const {view}=await render(`/returns?orderNo=${number}`);
 await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('源力飲'));
 expect(get).toHaveBeenCalledWith('/admin/orders?orderNo=123&take=1',expect.objectContaining({signal:expect.any(AbortSignal)}));
 expect(get).toHaveBeenCalledWith(`/admin/orders/${order.orderId}`,expect.objectContaining({signal:expect.any(AbortSignal)}));
 expect(view.root.findAllByType('a').some(link=>link.props.href==='/fulfillment?orderNo=123')).toBe(true);
 expect(JSON.stringify(view.toJSON())).toContain('不自動計算或收付差額');
 const quantity=view.root.findAllByType('input').find(input=>input.props.value==='0')!;
 act(()=>quantity.props.onChange({target:{value:'1'}}));
 await act(async()=>createButton(view).props.onClick(event));
 expect(command).toHaveBeenCalledWith(`/admin/orders/${order.orderId}/returns`,expect.objectContaining({lines:[{orderLineId:'line-1',quantity:'1'}]}));
 expect(JSON.stringify(view.toJSON())).toContain('返回原出貨單驗收');
 act(()=>view.unmount());
});

it.each([
 ['different order',[{...order,orderNo:'124'}]],
 ['ambiguous results',[order,{...order,orderId:'other'}]],
 ['missing order',[]],
])('does not select the first search result for %s',async(_label,results)=>{
 vi.mocked(get).mockImplementation(async(path:string)=>({data:path.startsWith('/admin/orders?')?results:[]}) as any);
 const {view}=await render();
 await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('找不到與來源出貨單完全相符'));
 expect(createButton(view).props.disabled).toBe(true);
 expect(vi.mocked(get).mock.calls.some(([path])=>path===`/admin/orders/${order.orderId}`)).toBe(false);
 await act(async()=>createButton(view).props.onClick(event));expect(command).not.toHaveBeenCalled();
 act(()=>view.unmount());
});

it('rejects order detail that no longer matches the source shipment',async()=>{
 vi.mocked(get).mockImplementation(async(path:string)=>({data:path==='/admin/orders?orderNo=123&take=1'?[order]:path===`/admin/orders/${order.orderId}`?{...order,orderNo:'456'}:[]}) as any);
 const {view}=await render();
 await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('訂單資料已變更'));
 expect(createButton(view).props.disabled).toBe(true);expect(command).not.toHaveBeenCalled();act(()=>view.unmount());
});

it('rejects malformed order numbers without reading or selecting an order',async()=>{
 const {view}=await render('/returns?orderNo=not-an-order');
 expect(JSON.stringify(view.toJSON())).toContain('來源訂單號格式不正確');
 expect(vi.mocked(get).mock.calls.some(([path])=>path.startsWith('/admin/orders'))).toBe(false);
 expect(createButton(view).props.disabled).toBe(true);act(()=>view.unmount());
});

it('aborts a stale deep-link lookup when the operator changes the source order',async()=>{
 let resolve:(value:unknown)=>void=()=>{};
 vi.mocked(get).mockImplementation(async(path:string)=>{
  if(path==='/admin/orders?orderNo=123&take=1')return await new Promise(done=>{resolve=done;}) as any;
  if(path==='/admin/orders?orderNo=456&take=1')return {data:[{...order,orderNo:'456',orderId:'second'}]} as any;
  if(path==='/admin/orders/second')return {data:{...order,orderNo:'456',orderId:'second'}} as any;
  return {data:[]} as any;
 });
 const {view,navigate}=await render();
 await vi.waitFor(()=>expect(get).toHaveBeenCalledWith('/admin/orders?orderNo=123&take=1',expect.any(Object)));
 const originalOptions=vi.mocked(get).mock.calls.find(([path])=>path==='/admin/orders?orderNo=123&take=1')![1];
 await act(async()=>navigate('/returns?orderNo=456'));
 await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('訂單 456'));
 expect(originalOptions?.signal?.aborted).toBe(true);
 await act(async()=>resolve({data:[order]}));
 expect(vi.mocked(get).mock.calls.some(([path])=>path===`/admin/orders/${order.orderId}`)).toBe(false);
 expect(JSON.stringify(view.toJSON())).not.toContain('訂單 123');
 act(()=>view.unmount());
});
