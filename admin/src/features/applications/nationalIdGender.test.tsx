import React from 'react';
import {act,create} from 'react-test-renderer';
import {it,expect,vi} from 'vitest';
import {nationalIdGenderCheck,ocrMismatch} from './reviewDocuments';
import {FormalApplicationEditor} from './FormalApplicationEditor';
vi.mock('./ReviewDocument',()=>({ReviewDocument:()=>null}));

it('checks both sex codes only after validating the national ID checksum',()=>{
 expect(nationalIdGenderCheck('NATIONAL_ID','A123456789','MALE')).toBe('MATCH');
 expect(nationalIdGenderCheck('NATIONAL_ID','A123456789','FEMALE')).toBe('MISMATCH');
 expect(nationalIdGenderCheck('NATIONAL_ID','A223456781','FEMALE')).toBe('MATCH');
 expect(nationalIdGenderCheck('NATIONAL_ID','A223456781','MALE')).toBe('MISMATCH');
 expect(nationalIdGenderCheck('NATIONAL_ID','A123456788','FEMALE')).toBe('INVALID_ID');
 expect(nationalIdGenderCheck('NATIONAL_ID','A823456789','MALE')).toBe('INVALID_ID');
 expect(nationalIdGenderCheck('PASSPORT','A123456789','FEMALE')).toBe('NOT_APPLICABLE');
 expect(nationalIdGenderCheck('RESIDENCE_PERMIT','A223456781','MALE')).toBe('NOT_APPLICABLE');
 expect(nationalIdGenderCheck('NATIONAL_ID',' a123456789 ','MALE')).toBe('MATCH');
});

it.each(['UNDISCLOSED','OTHER'])('does not infer or flag a gender when the member selects %s',gender=>{
 expect(nationalIdGenderCheck('NATIONAL_ID','A123456789',gender)).not.toBe('MISMATCH');
 expect(ocrMismatch('性別 男','gender',gender)).toBe(false);
 expect(ocrMismatch('','gender',gender)).toBe(false);
});

it('warns independently of OCR and clears the warning when choosing not to disclose without changing identity data',async()=>{
 const payload={gender:'FEMALE',identityDocumentType:'NATIONAL_ID',identityDocumentNumber:'A123456789'};
 let tree:any;
 await act(async()=>{tree=create(<FormalApplicationEditor detail={{id:'app',version:1,status:'UNDER_REVIEW',payload}} onSaved={async()=>{}} onEditingChange={vi.fn()}/>)});
 const field=()=>tree.root.findAllByType('label').find((n:any)=>n.children[0]==='性別');
 expect(field().props.className).toBe('ocr-mismatch');
 expect(field().findByType('small').children.join('')).toContain('第二碼');
 await act(async()=>field().findByType('select').props.onChange({target:{value:'UNDISCLOSED'}}));
 expect(field().props.className).toBe('');
 expect(field().findByType('select').props.value).toBe('UNDISCLOSED');
 expect(field().findByType('small').children.join('')).toContain('不進行性別比對');
 expect(tree.root.findAllByType('input').some((n:any)=>n.props.value==='A123456789')).toBe(true);
 expect(payload.gender).toBe('FEMALE');
 await act(async()=>tree.unmount());
});
