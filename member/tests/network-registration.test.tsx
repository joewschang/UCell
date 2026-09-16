import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import NetworkRegistration from '../src/NetworkRegistration';

let tree:ReactTestRenderer|undefined;
const person={name:'LINE 使用者',alias:null,memberNo:'person-1',email:null,phone:null,gender:null,birthDate:null,membershipState:null,mobileVerifiedAt:null} as const;
const contract={id:'contract-1',type:'NETWORK_MEMBERSHIP',version:'V1',title:'網路會員合約',content:'測試合約內容',contentHash:'a'.repeat(64),required:true,effectiveFrom:'2026-01-01T00:00:00Z',effectiveTo:null,acceptedAt:null};
const response=(data:unknown,status=200)=>new Response(JSON.stringify({data,meta:{request_id:'registration-test',api_version:'v1',timestamp:'2026-09-17T00:00:00Z'}}),{status});
beforeEach(()=>vi.stubGlobal('sessionStorage',{getItem:()=>null}));
afterEach(()=>{if(tree)act(()=>tree!.unmount());tree=undefined;vi.unstubAllGlobals();vi.restoreAllMocks();});
const field=(label:string)=>tree!.root.findAllByType('label').find(node=>node.children.some(child=>typeof child==='string'&&child.includes(label)))!.findByType(label==='性別'?'select':'input');
const submit=()=>tree!.root.findByType('form').props.onSubmit({preventDefault(){}});
function complete(){act(()=>{field('姓名').props.onChange({target:{value:'王小明'}});field('別名').props.onChange({target:{value:'小明'}});field('性別').props.onChange({target:{value:'UNDISCLOSED'}});field('出生年月日').props.onChange({target:{value:'1990-01-02'}});field('手機').props.onChange({target:{value:'+886912345678'}});field('Email').props.onChange({target:{value:'member@example.invalid'}});tree!.root.findAllByType('input').find(node=>node.props.type==='checkbox')!.props.onChange({target:{checked:true}});});}

it('registers the authenticated LINE Person with explicit contract acceptance and no OTP fields',async()=>{
 const fetch=vi.fn(async(_url:string,init:RequestInit)=>init.method==='POST'?response({personId:'person-1',membershipState:'NETWORK_MEMBER',enabledAuthenticationProvider:'LINE',qualificationCreated:false,replayed:false},201):response([contract]));vi.stubGlobal('fetch',fetch);
 const refresh=vi.fn();await act(async()=>{tree=create(<NetworkRegistration person={person} refresh={refresh}/>);});
 complete();
 await act(async()=>submit());
 const post=fetch.mock.calls.find(([,init])=>init.method==='POST')!;expect(post[0]).toContain('/member/registration/network');expect(new Headers(post[1].headers).get('Idempotency-Key')).toBeTruthy();
 expect(JSON.parse(post[1].body as string)).toEqual({contractVersionId:'contract-1',accepted:true,legalName:'王小明',alias:'小明',gender:'UNDISCLOSED',birthDate:'1990-01-02',mobile:'+886912345678',email:'member@example.invalid'});
 expect(JSON.stringify(post[1].body)).not.toContain('otp');expect(JSON.stringify(tree!.toJSON())).toContain('網路會員註冊完成');expect(refresh).toHaveBeenCalledOnce();
});

it('preserves the registration body and idempotency key across a retryable conflict',async()=>{
 let posts=0;const fetch=vi.fn(async(_url:string,init:RequestInit)=>{if(init.method!=='POST')return response([contract]);if(posts++===0)return response({code:'RETRYABLE_CONFLICT'},409);return response({personId:'person-1',membershipState:'NETWORK_MEMBER',enabledAuthenticationProvider:'LINE',qualificationCreated:false,replayed:true},201);});vi.stubGlobal('fetch',fetch);
 await act(async()=>{tree=create(<NetworkRegistration person={person} refresh={()=>{}}/>);});complete();
 await act(async()=>submit());expect(JSON.stringify(tree!.toJSON())).toContain('保留原資料重試');await act(async()=>submit());
 const calls=fetch.mock.calls.filter(([,init])=>init.method==='POST');expect(calls).toHaveLength(2);expect(calls[0][1].body).toBe(calls[1][1].body);expect(new Headers(calls[0][1].headers).get('Idempotency-Key')).toBe(new Headers(calls[1][1].headers).get('Idempotency-Key'));
});

it('requires explicit consent before sending registration',async()=>{
 const fetch=vi.fn(async()=>response([contract]));vi.stubGlobal('fetch',fetch);await act(async()=>{tree=create(<NetworkRegistration person={person} refresh={()=>{}}/>);});
 await act(async()=>submit());expect(fetch.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(0);expect(JSON.stringify(tree!.toJSON())).toContain('請先閱讀並同意');
});
