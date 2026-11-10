const fs=require('node:fs');
const file='/app/apps/api/dist/modules/content/content.module.js';
const s=fs.readFileSync(file,'utf8');
for(const marker of ['controllers:', 'providers:'])if((s.match(new RegExp(marker+'\\s*\\[','g'))||[]).length!==1)throw Error('Unexpected module layout '+marker);
fs.writeFileSync(file,'const healthGame=require("./health-game.controller");\n'+s.replace(/controllers:\s*\[/,'controllers:[healthGame.PublicHealthGame,healthGame.MemberHealthGame,healthGame.AdminHealthGame,').replace(/providers:\s*\[/,'providers:[healthGame.HealthGameService,'));
