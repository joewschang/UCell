import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {validTaiwanNationalId,validEmail} from '../src/enrollmentValidation';
import areas from '../src/taiwanPostal.json';
import DeliveryProfileEditor from '../src/DeliveryProfileEditor';
import {OrderProgress,isKerry} from '../src/MyOrders';
vi.mock('../src/memberData',()=>({updateDeliveryProfile:vi.fn(async()=>({}))}));
it('checks national identity checksum, letter mapping and email format',()=>{expect(validTaiwanNationalId('a123456789')).toBe(true);for(const id of ['A123456788','A323456789','123456789','A1234567890'])expect(validTaiwanNationalId(id)).toBe(false);expect(validEmail('member@example.com')).toBe(true);for(const email of ['a@','a@b','a b@x.com','a@@x.com'])expect(validEmail(email)).toBe(false);});
it('cascades districts and resets stale district and zip when county changes',async()=>{let t:any;await act(async()=>{t=create(<DeliveryProfileEditor profile={{recipientName:'測試',phone:'0912345678',countryCode:'TW',region:'臺中市',city:'大里區',postalCode:'412',address:'測試路1號',complete:true,updatedAt:null}} refresh={()=>{}}/>)});let selects=t.root.findAllByType('select');expect(selects[1].props.value).toBe('大里區');await act(async()=>selects[0].props.onChange({target:{value:'臺北市'}}));selects=t.root.findAllByType('select');expect(selects[1].props.value).toBe('');await act(async()=>selects[1].props.onChange({target:{value:'中正區'}}));expect(t.root.findAllByType('input').find((i:any)=>i.props.readOnly).props.value).toBe('100');act(()=>t.unmount());expect(areas.find(x=>x.region==='臺中市'&&x.district==='大里區')?.postalCode).toBe('412');});
it('shows split shipment tracking from recorded facts without constructing an unverified tracking URL',()=>{let t:any;act(()=>{t=create(<OrderProgress order={{orderNo:'123',status:'PAID',paymentStatus:'PAID',paidAt:null,total:'600',createdAt:'2026-10-22',purpose:'ENTRY',items:[],fulfillments:[{status:'SHIPPED',shipments:[{carrier:'KERRY_TJ',trackingNo:'12345678901',status:'IN_TRANSIT',updatedAt:'2026-10-22'}]}]}}/>)});expect(JSON.stringify(t.toJSON())).toContain('12345678901');expect(JSON.stringify(t.toJSON())).toContain('運送中');expect(t.root.findByType('a').props.href).toBe('https://www.kerrytj.com/zh/checking');expect(isKerry('BLACK_CAT')).toBe(false);act(()=>t.unmount());});

it('postal selections cover all 22 counties without blank districts',()=>{expect(new Set(areas.map(x=>x.region)).size).toBe(22);expect(areas.every(x=>x.district&&/^\d{3}$/.test(x.postalCode))).toBe(true);});
