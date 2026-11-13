require('ts-node/register/transpile-only');
const fs=require('node:fs'),path=require('node:path');
const {DailyGreetingService}=require('./src/modules/daily-greetings/daily-greeting.service');
const {greetingPhoto}=require('./src/modules/daily-greetings/greeting-photo');
(async()=>{const service=new DailyGreetingService();const dir=path.resolve('../../../deployment/greeting-photos/evidence/previews');fs.mkdirSync(dir,{recursive:true});for(let i=0;i<10;i++){const date=`2026-11-${String(4+i).padStart(2,'0')}`;const png=await service.image(date,new Date('2026-11-13T12:00:00Z'));fs.writeFileSync(path.join(dir,`${date}-${greetingPhoto(date).id}.png`),png);console.log(date,png.length)}service.onModuleDestroy()})().catch(e=>{console.error(e);process.exitCode=1});
