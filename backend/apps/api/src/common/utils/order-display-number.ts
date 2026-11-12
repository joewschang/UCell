import {Prisma} from '@ucell/database';
/** Adds a display identifier without changing numeric API references or UUID relations. */
export async function enrichOrderNumbers(db:any,body:any){
 const ids=new Set<string>();const objects:any[]=[];const notices:any[]=[];
 function visit(v:any){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(visit);return;}if(/^[1-9][0-9]*$/.test(String(v.orderNo??''))){ids.add(String(v.orderNo));objects.push(v);}if(v.category==='ORDER'&&typeof v.body==='string'){for(const m of v.body.matchAll(/訂單(?:編號)?[：:\s]*(\d{1,19})(?!\d)/g))ids.add(m[1]);notices.push(v);}Object.values(v).forEach(visit);}
 visit(body);if(!ids.size)return body;
 const values=[...ids];const byNo=new Map<string,string>();
 for(let i=0;i<values.length;i+=500){const rows=await db.$queryRaw(Prisma.sql`SELECT order_no::text AS n,public_order_no AS code FROM commerce."order" WHERE order_no IN (${Prisma.join(values.slice(i,i+500).map(BigInt))})`);for(const r of rows)if(r.code)byNo.set(r.n,r.code);}
 for(const o of objects){const code=byNo.get(String(o.orderNo));if(code)o.displayOrderNo=code;}for(const n of notices)n.body=n.body.replace(/(訂單(?:編號)?[：:\s]*)(\d{1,19})(?!\d)/g,(all:string,label:string,no:string)=>byNo.has(no)?label+byNo.get(no):all);return body;
}
