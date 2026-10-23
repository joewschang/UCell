import React from 'react';
import {act,create} from 'react-test-renderer';
import {it,expect,vi} from 'vitest';
import FormalUpgrade from '../src/FormalUpgrade';
vi.mock('../src/useResource',()=>({useResource:()=>({data:[{id:'contract',title:'會員合約',version:'1',content:'內容',acceptedAt:'2026-01-01'}],retry:vi.fn()})}));
it('restores saved identity, contact and bank fields and existing uploads without replacing edits on reload',async()=>{
 const initial:any={application:{id:'app'},draft:{version:1,payload:{legalName:'原填姓名',identityDocumentNumber:'A123456789',bankAccount:'12345678',email:'saved@example.com'},documents:['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER']}};let t:any;
 await act(async()=>{t=create(<FormalUpgrade initial={initial} draftOnly/>);});
 const name=()=>t.root.findAllByType('input').find((x:any)=>x.props.autoComplete==='name');
 expect(name().props.value).toBe('原填姓名');expect(t.root.findAllByType('input').some((x:any)=>x.props.value==='12345678')).toBe(true);
 expect(JSON.stringify(t.toJSON()).match(/已上傳成功，系統已保存。/g)?.length).toBe(3);
 await act(async()=>name().props.onChange({target:{value:'新修改姓名'}}));
 await act(async()=>t.update(<FormalUpgrade initial={{...initial}} draftOnly/>));
 expect(name().props.value).toBe('新修改姓名');act(()=>t.unmount());
});
