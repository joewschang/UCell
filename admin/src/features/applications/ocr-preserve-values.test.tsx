import React from 'react';
import {act,create} from 'react-test-renderer';
import {it,expect,vi} from 'vitest';
import {FormalApplicationEditor} from './FormalApplicationEditor';
vi.mock('./ReviewDocument',()=>({ReviewDocument:({onText}:any)=><button type="button" onClick={()=>onText('錯誤辨識文字')}>模擬辨識</button>}));
it('OCR mismatch only flags fields and retains every applicant-entered value',async()=>{
 const payload={legalName:'測試姓名',gender:'MALE',birthDate:'1990-01-01',identityDocumentNumber:'A123456789',bankAccount:'123456789012',accountHolder:'測試姓名',hasSpouse:true,spouseName:'測試配偶'};
 let tree:any;await act(async()=>{tree=create(<FormalApplicationEditor detail={{id:'app',version:1,status:'UNDER_REVIEW',payload}} documents={['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'].map(type=>({id:type,type,status:'PRESENT'}))} onSaved={async()=>{}} onEditingChange={vi.fn()}/>)});
 const values=()=>tree.root.findAll((n:any)=>n.type==='input'||n.type==='select').map((n:any)=>n.props.value);
 const before=values();
 for(const button of tree.root.findAllByType('button').filter((n:any)=>n.children[0]==='模擬辨識'))await act(async()=>button.props.onClick());
 expect(values()).toEqual(before);
 expect(tree.root.findAllByProps({className:'ocr-mismatch'})).toHaveLength(7);
 act(()=>tree.unmount());
});
