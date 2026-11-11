const fs=require('node:fs');
const file='/app/apps/api/dist/app.module.js';
const code=fs.readFileSync(file,'utf8');
if(code.includes('greeting-overlay-registration'))throw Error('Greeting registration already exists');
fs.appendFileSync(file,`
// greeting-overlay-registration
Reflect.defineMetadata('imports', [...Reflect.getMetadata('imports', exports.AppModule), require('./modules/daily-greetings/daily-greeting.module').DailyGreetingModule, require('./modules/daily-greetings/greeting-publication.module').GreetingPublicationModule], exports.AppModule);
`);
