import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@line/liff',()=>({default:{init:vi.fn(async()=>{}),isLoggedIn:()=>false,isInClient:()=>false}}));
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules()});
it('revalidates the newly issued Web session instead of retaining the cached login screen',async()=>{
 vi.stubEnv('VITE_ENABLE_MOCK','false');vi.stubEnv('VITE_LIFF_ID','TEST');
 const values=new Map<string,string>();
 vi.stubGlobal('sessionStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
 vi.stubGlobal('window',{location:{pathname:'/login',search:'',hash:''}});
 const fetch=vi.fn(async(_url:string,_init:RequestInit)=>({ok:true,status:200,json:async()=>({data:{name:'Test',alias:null,memberNo:'0000000001',email:null,phone:null,gender:null,birthDate:null,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:null},meta:{api_version:'v1',request_id:'test',timestamp:new Date().toISOString()}})}));
 vi.stubGlobal('fetch',fetch);
 const {bootstrapLiff}=await import('../src/liff');
 expect((await bootstrapLiff()).mode).toBe('web-login');
 values.set('ucell_member_token','TEST_NEW_SESSION');
 expect((await bootstrapLiff(true)).mode).toBe('connected');
 expect(fetch).toHaveBeenCalledOnce();
 expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer TEST_NEW_SESSION');
});
