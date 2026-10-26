import React from 'react';
import {act,create} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
import NetworkRegistration from '../src/NetworkRegistration';
import {registrationContactError} from '../src/networkRegistrationFields';
afterEach(()=>vi.unstubAllGlobals());
it.each([['0912345678',''],['','person@example.com']])('submits either contact without identity or optional demographics',async(mobile,email)=>{
 vi.stubGlobal('sessionStorage',{getItem:()=>null});
 const fetch=vi.fn(async(url:string,init:any={})=>new Response(JSON.stringify({data:url.endsWith('/policy')?{smsRequired:false,emailRequired:false}:init.method==='POST'?{personId:'test',membershipState:'NETWORK_MEMBER',enabledAuthenticationProvider:'LINE',qualificationCreated:false}:[{id:'contract',type:'NETWORK_MEMBERSHIP',version:'1',title:'會員合約',content:'內容',contentHash:'a'.repeat(64),required:true,effectiveFrom:'2026-01-01',effectiveTo:null,acceptedAt:null}],meta:{request_id:'test',api_version:'v1',timestamp:new Date().toISOString()}})));
 vi.stubGlobal('fetch',fetch);let tree:any;
 await act(async()=>{tree=create(<NetworkRegistration person={{name:'暱稱',alias:null,memberNo:'2610000000',email:null,phone:null,gender:null,birthDate:null,membershipState:null,mobileVerifiedAt:null}} refresh={()=>{}}/>)});
 act(()=>{tree.root.findByProps({type:'tel'}).props.onChange({target:{value:mobile}});tree.root.findByProps({type:'email'}).props.onChange({target:{value:email}});tree.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}})});
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
 const call=fetch.mock.calls.find(([,init])=>init?.method==='POST');expect(call).toBeTruthy();const payload=JSON.parse(call![1].body);
 for(const key of ['legalName','identityDocumentNumber','birthDate','gender'])expect(payload).not.toHaveProperty(key);
 expect(payload.mobile||payload.email).toBeTruthy();act(()=>tree.unmount());
});
it('rejects neither contact and invalid supplied optional contact',()=>{
 expect(registrationContactError('','')).toContain('至少');expect(registrationContactError('bad','a@b.com')).toContain('手機');expect(registrationContactError('0912345678','bad')).toContain('Email');
});
