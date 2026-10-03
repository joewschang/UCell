#!/usr/bin/env node
// Uses the existing worker environment; never accepts a token on the command line.
const path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {LineRichMenuClient,LineRichMenuReconciler}=require(path.resolve(__dirname,'../apps/worker/dist/line-rich-menu-reconciliation.js'));
async function main(){
 if(!process.argv.includes('--apply'))throw new Error('Use --apply to ensure default and reconcile verified bindings; audit with the documented read-only LINE endpoints first.');
 const db=new PrismaClient();
 try{
  const client=new LineRichMenuClient({token:process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN??process.env.LINE_CHANNEL_ACCESS_TOKEN??'',basicId:process.env.LINE_EXPECTED_BASIC_ID??'',defaultMenuId:process.env.LINE_DEFAULT_RICH_MENU_ID??'',memberMenuId:process.env.LINE_MEMBER_RICH_MENU_ID??''});
  const runner=new LineRichMenuReconciler(db,client,process.env.LINE_MEMBER_RICH_MENU_ID??'');
  const total={pages:0,checked:0,failures:0};let scanComplete=false;
  do{const result=await runner.batch();total.pages++;for(const [key,value] of Object.entries(result))if(typeof value==='number')total[key]=(total[key]??0)+value;scanComplete=result.scanComplete;}while(!scanComplete&&total.pages<1000);
  console.log(JSON.stringify({event:'LINE_RICH_MENU_BACKFILL',...total,scanComplete}));
  if(total.failures||!scanComplete)process.exitCode=1;
 }finally{await db.$disconnect();}
}
main().catch(()=>{console.error(JSON.stringify({event:'LINE_RICH_MENU_BACKFILL_FAILED',errorCode:'LINE_RICH_MENU_UNAVAILABLE'}));process.exitCode=1;});
