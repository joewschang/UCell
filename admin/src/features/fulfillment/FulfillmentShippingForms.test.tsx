import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {DeliveryCaptureForm,ShipmentRegistrationForm} from './FulfillmentShippingForms';
vi.mock('../../lib/api',()=>({get:vi.fn(),ApiError:class extends Error{}}));
it('retains explicit delivery input on failure and submits the same content on retry',async()=>{
 const submit=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);let view:ReturnType<typeof create>;
 act(()=>{view=create(<DeliveryCaptureForm expectedVersion={0} disabled={false} submit={submit}/>);});
 act(()=>view!.root.findByType('button').props.onClick());
 const inputs=view!.root.findAllByType('input');
 act(()=>{inputs[0].props.onChange({target:{value:'Synthetic recipient'}});inputs[1].props.onChange({target:{value:'0900000000'}});inputs[2].props.onChange({target:{value:'100'}});view!.root.findByType('textarea').props.onChange({target:{value:'Synthetic delivery address'}});});
 await act(async()=>view!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(view!.root.findByType('textarea').props.value).toBe('Synthetic delivery address');
 act(()=>view!.update(<DeliveryCaptureForm expectedVersion={2} disabled={false} submit={submit}/>));
 await act(async()=>view!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(submit.mock.calls[1]).toEqual(submit.mock.calls[0]);expect(submit.mock.calls[0][0]).toMatchObject({expectedVersion:0,countryCode:'TW',recipientName:'Synthetic recipient',address:'Synthetic delivery address'});
 expect(view!.root.findAllByType('form')).toHaveLength(0);act(()=>view!.unmount());
});
it('requires an approved selection and records explicit package and label checks',async()=>{
 const connectionReference='a'.repeat(64);vi.mocked(get).mockResolvedValue({data:[{connectionReference,provider:'BLACK_CAT',connectionKey:'primary',version:1,environment:'TEST'}]});
 const submit=vi.fn().mockResolvedValue(true);let view:ReturnType<typeof create>;
 act(()=>{view=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ShipmentRegistrationForm disabled={false} submit={submit}/></QueryClientProvider>);});
 await act(async()=>view!.root.findByType('button').props.onClick());
 await vi.waitFor(()=>expect(view!.root.findAllByType('option')).toHaveLength(2));
 const inputs=view!.root.findAllByType('input');
 act(()=>{view!.root.findByType('select').props.onChange({target:{value:connectionReference}});inputs[0].props.onChange({target:{value:'PROVIDER-1'}});inputs[1].props.onChange({target:{value:'TRACK-1'}});inputs[2].props.onChange({target:{checked:true}});inputs[3].props.onChange({target:{checked:true}});});
 await act(async()=>view!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(submit).toHaveBeenCalledWith({connectionReference,providerShipmentReference:'PROVIDER-1',trackingNo:'TRACK-1',packageIntegrityConfirmed:true,labelVerified:true});
 expect(view!.root.findAllByType('form')).toHaveLength(0);act(()=>view!.unmount());
});
it('explains missing approved logistics configuration and disables registration',async()=>{
 vi.mocked(get).mockResolvedValue({data:[]});const submit=vi.fn();let view:ReturnType<typeof create>;
 act(()=>{view=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ShipmentRegistrationForm disabled={false} submit={submit}/></QueryClientProvider>);});
 await act(async()=>view!.root.findByType('button').props.onClick());
 await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain('目前沒有可用的已核准物流設定'));
 expect(view!.root.findAllByType('button').find(b=>b.props.type==='submit')!.props.disabled).toBe(true);expect(submit).not.toHaveBeenCalled();act(()=>view!.unmount());
});
