import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {get,command} from '../../lib/api';
import {FulfillmentPage} from './FulfillmentPage';
const auth=vi.hoisted(()=>({role:'ORDER_OPS'}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:auth.role}})}));
vi.mock('../../lib/api',()=>({get:vi.fn(),command:vi.fn(),ApiError:class extends Error{}}));
const sourceReference='a'.repeat(64);
beforeEach(()=>{auth.role='ORDER_OPS';vi.mocked(command).mockReset().mockResolvedValue({data:{}});vi.mocked(get).mockReset().mockResolvedValue({data:{orderNo:'123',fulfillments:[{fulfillmentKey:'F-123',status:'READY',sources:[{sourceReference,sku:'TIP-363',quantity:'1',serialNos:[]}],packVerification:null,erpHandoff:null}]}});});
async function render(marker='TIP-363'){let view:ReturnType<typeof create>;await act(async()=>{view=create(<MemoryRouter initialEntries={['/fulfillment?orderNo=123']}><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><FulfillmentPage/></QueryClientProvider></MemoryRouter>);});await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain(marker));return view!;}
it('submits scanned SKU/serial with server source reference and keeps ERP disabled until verified',async()=>{
 const view=await render();
 const inputs=view.root.findAllByType('input');
 await act(async()=>{inputs[1].props.onChange({target:{value:'TIP-363'}});inputs[2].props.onChange({target:{value:'a0010001'}});});
 await act(async()=>{await view.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}});});
 expect(command).toHaveBeenCalledWith('/admin/fulfillment/orders/123/F-123/scans',{sourceReference,sku:'TIP-363',serialNo:'A0010001'});
 expect(view.root.findAllByType('button').find(b=>b.children.join('')==='建立 ERP 交付請求')?.props.disabled).toBe(true);
 expect(JSON.stringify(view.toJSON())).toContain('序號已核對');
 expect(JSON.stringify(view.toJSON())).not.toContain(sourceReference);
 act(()=>view.unmount());
});
it('renders read-only evidence for audit roles with no mutation controls',async()=>{
 auth.role='COMPLIANCE_AUDIT';const view=await render();
 expect(JSON.stringify(view.toJSON())).toContain('唯讀檢視');
 expect(view.root.findAllByType('button').map(b=>b.children.join(''))).toEqual(['載入出貨明細']);
 expect(command).not.toHaveBeenCalled();act(()=>view.unmount());
});
it('retains scanned input after failure and permits an explicit retry',async()=>{
 vi.mocked(command).mockRejectedValueOnce(new Error('請重新核對序號'));
 const view=await render(),inputs=view.root.findAllByType('input');
 await act(async()=>{inputs[1].props.onChange({target:{value:'TIP-363'}});inputs[2].props.onChange({target:{value:'A0010001'}});});
 await act(async()=>{await view.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}});});
 expect(view.root.findAllByType('input')[2].props.value).toBe('A0010001');
 expect(JSON.stringify(view.toJSON())).toContain('請重新核對序號');act(()=>view.unmount());
});
it('prepares a paid order from the empty state and can reload the same order',async()=>{
 vi.mocked(get).mockResolvedValue({data:{orderNo:'123',status:'PAID',fulfillments:[]}});
 const view=await render('此訂單尚無出貨配置');
 await act(async()=>{await view.root.findAllByType('button').find(b=>b.children.join('')==='依付款明細建立出貨配置')!.props.onClick();});
 expect(command).toHaveBeenCalledWith('/admin/fulfillment/orders/123/prepare',{});
 vi.mocked(get).mockClear();
 await act(async()=>{await view.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}});});
 expect(get).toHaveBeenCalledWith('/admin/fulfillment/orders/123');act(()=>view.unmount());
});
it('records actual ERP evidence separately and preserves its retry identity after failure',async()=>{
 vi.mocked(get).mockResolvedValue({data:{orderNo:'123',status:'PAID',fulfillments:[{fulfillmentKey:'F-123',status:'PACKED',sources:[],packVerification:{status:'PACK_VERIFIED'},erpHandoff:{results:[{outcome:'PARTIAL',occurredAt:'2026-09-29T00:00:00Z',resultHash:'a'}]}}]}});
 vi.mocked(command).mockRejectedValueOnce(new Error('暫時無法連線')).mockResolvedValueOnce({data:{outcome:'MATCHED'}});
 const view=await render('部分回報，尚未完成');
 const inputs=view.root.findAllByType('input');
 expect(inputs[1].props.value).toBe('');expect(inputs[3].props.value).toBe('');
 await act(async()=>{inputs[1].props.onChange({target:{value:'ERP-601'}});inputs[2].props.onChange({target:{value:'2026-09-29T08:00'}});inputs[3].props.onChange({target:{value:'TIP-363'}});view.root.findByType('textarea').props.onChange({target:{value:'a0010001\na0010002'}});});
 await act(async()=>{await view.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}});});
 const first=vi.mocked(command).mock.calls[0];
 expect(first[0]).toBe('/admin/fulfillment/orders/123/F-123/erp-results');
 expect(first[1]).toMatchObject({providerReference:'ERP-601',lines:[{sku:'TIP-363',quantity:'2',serialNos:['A0010001','A0010002']}]});
 expect(view.root.findByType('textarea').props.value).toContain('a0010001');
 await act(async()=>{await view.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}});});
 expect(vi.mocked(command).mock.calls[1]).toEqual(first);
 expect(JSON.stringify(view.toJSON())).toContain('ERP 回報已保存');act(()=>view.unmount());
});
it('offers controlled retry only for stopped ERP dispatch and hides it from auditors',async()=>{
 vi.mocked(get).mockResolvedValue({data:{orderNo:'123',fulfillments:[{fulfillmentKey:'F-123',status:'PACKED',sources:[],packVerification:{status:'PACK_VERIFIED'},erpHandoff:{deliveryState:'DEAD',dispatch:{outcome:'UNKNOWN',attemptNumber:10},results:[]}}]}});
 const view=await render('自動重試已停止');
 await act(async()=>{await view.root.findAllByType('button').find(b=>b.children.join('')==='重新排程 ERP 受理核對')!.props.onClick();});
 expect(command).toHaveBeenCalledWith('/admin/fulfillment/orders/123/F-123/erp-retry',{});act(()=>view.unmount());
 auth.role='COMPLIANCE_AUDIT';const audit=await render('自動重試已停止');
 expect(audit.root.findAllByType('button').map(b=>b.children.join(''))).toEqual(['載入出貨明細']);act(()=>audit.unmount());
});
it('links shipment evidence and receives only the selected return with scanned serial',async()=>{
 const shipmentReference='b'.repeat(64),returnReference='c'.repeat(64);
 vi.mocked(get).mockResolvedValue({data:{orderNo:'123',returns:[{returnReference,occurredAt:'2026-09-29T00:00:00Z',lines:[{sku:'TIP-363',quantity:'1'}]}],fulfillments:[{fulfillmentKey:'F-123',status:'SHIPPED',sources:[],shipments:[{shipmentReference,status:'PICKED_UP',trackingNo:'T-123',serials:[{serialNo:'A0010001',returned:false}]}],packVerification:{status:'PACK_VERIFIED'},erpHandoff:null}]}});
 const view=await render('物流已收件');
 await act(async()=>{await view.root.findAllByType('button').find(b=>b.children.join('')==='核對序號與物流證據')!.props.onClick();});
 expect(command).toHaveBeenCalledWith('/admin/fulfillment/orders/123/F-123/shipment-serials',{shipmentReference});
 await act(async()=>{view.root.findByType('select').props.onChange({target:{value:returnReference}});view.root.findAllByType('input')[1].props.onChange({target:{value:'a0010001'}});});
 await act(async()=>{await view.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}});});
 expect(command).toHaveBeenCalledWith('/admin/fulfillment/orders/123/F-123/return-serials',{returnReference,serialNos:['A0010001']});
 expect(view.root.findAllByType('input')[1].props.value).toBe('');act(()=>view.unmount());
});
