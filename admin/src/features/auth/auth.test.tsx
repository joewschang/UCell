import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Navigate,Route,Routes} from 'react-router-dom';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {api} from '../../lib/api';
vi.mock('./entra',()=>({acquireEntraIdToken:vi.fn(),entraLogout:vi.fn()}));
import {AuthProvider,useAuth} from './auth';

const stored=new Map<string,string>();
const listeners=new Map<string,Set<(event:unknown)=>void>>();
let tree:ReactTestRenderer|undefined;
let client:QueryClient|undefined;

const windowMock={
 addEventListener(type:string,listener:(event:unknown)=>void){const set=listeners.get(type)??new Set();set.add(listener);listeners.set(type,set);},
 removeEventListener(type:string,listener:(event:unknown)=>void){listeners.get(type)?.delete(listener);},
 dispatchEvent(event:{type:string}){for(const listener of listeners.get(event.type)??[])listener(event);return true;},
};

function PrivateRoute(){
 const {ready,user}=useAuth();
 if(!ready)return <p>驗證中</p>;
 return user?<p>PRIVATE_ADMIN_RECORD</p>:<Navigate to="/login" replace/>;
}

function flush(){return Promise.resolve().then(()=>Promise.resolve()).then(()=>Promise.resolve());}

beforeEach(()=>{
 stored.clear();listeners.clear();
 stored.set('ucell_admin_token','opaque-admin-session');
 stored.set('ucell_admin_expires_at','2026-09-19T02:00:00.000Z');
 stored.set('ucell_admin_user',JSON.stringify({name:'Admin',role:'SUPER_ADMIN',provider:'ENTRA'}));
 vi.stubGlobal('sessionStorage',{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)});
 vi.stubGlobal('window',windowMock);
 vi.stubGlobal('CustomEvent',class extends Event{});
 vi.stubGlobal('crypto',{randomUUID:()=> '11111111-1111-4111-8111-111111111111'});
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>String(input).endsWith('/auth/admin/me')
  ?new Response(JSON.stringify({data:{person:{preferredName:'Admin'},role:'SUPER_ADMIN',provider:'ENTRA',expiresAt:'2026-09-19T02:00:00.000Z'}}))
  :new Response(JSON.stringify({message:'private server detail'}),{status:401}),
 ));
 client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 client.setQueryData(['private-dashboard'],{amount:'42000'});
});

afterEach(()=>{
 if(tree)act(()=>tree!.unmount());tree=undefined;
 client?.clear();client=undefined;
 vi.unstubAllGlobals();vi.restoreAllMocks();listeners.clear();stored.clear();
});

it('clears mounted Admin private UI, cache and credentials after a live 401, then falls back to login',async()=>{
 await act(async()=>{
  tree=create(<QueryClientProvider client={client!}><MemoryRouter initialEntries={['/private']}><AuthProvider><Routes><Route path="/private" element={<PrivateRoute/>}/><Route path="/login" element={<p>LOGIN_FALLBACK</p>}/></Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
  await flush();
 });
 expect(JSON.stringify(tree!.toJSON())).toContain('PRIVATE_ADMIN_RECORD');
 expect(client!.getQueryData(['private-dashboard'])).toEqual({amount:'42000'});

 await act(async()=>{
  await expect(api('/admin/private')).rejects.toThrow('管理員工作階段已失效');
  await flush();
 });
 const output=JSON.stringify(tree!.toJSON());
 expect(output).toContain('LOGIN_FALLBACK');
 expect(output).not.toContain('PRIVATE_ADMIN_RECORD');
 expect(output).not.toContain('private server detail');
 expect(client!.getQueryCache().getAll()).toHaveLength(0);
 for(const key of ['ucell_admin_token','ucell_admin_expires_at','ucell_admin_user'])expect(stored.has(key)).toBe(false);
});
