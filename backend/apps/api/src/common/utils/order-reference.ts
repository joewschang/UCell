import {Prisma} from '@ucell/database';
export async function orderReferenceMap(db:any,values:string[]){
 const result=new Map<string,string>();for(const value of values)if(/^[1-9][0-9]{0,17}$/.test(value))result.set(value,value);
 const codes=[...new Set(values.filter(v=>/^SL[0-9]{11}$/.test(v)))];if(codes.length){const rows=await db.$queryRaw(Prisma.sql`SELECT public_order_no AS code,order_no::text AS n FROM commerce."order" WHERE public_order_no IN (${Prisma.join(codes)})`);for(const r of rows)result.set(r.code,r.n);}return result;
}
