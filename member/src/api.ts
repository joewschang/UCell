const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
export async function api<T>(path:string, init:RequestInit={}):Promise<T>{
  const token=sessionStorage.getItem('ucell_member_token');
  const res=await fetch(`${base}${path}`,{...init,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...(init.headers||{})}});
  if(!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}
export type Qualification={id:string;code:string;rank:string;active:boolean;ballLabel:string};
export type Dashboard={memberName:string;memberNo:string;qualification:Qualification;monthlyRepurchaseStatus:'ACTIVE'|'PENDING'|'INACTIVE';pv:number|null;rpv:number|null;epv:number|null;bonusAmount:number|null;bonusStatus:'PENDING'|'EFFECTIVE'|'PAYABLE'|'PAID'};
