const fs=require('node:fs'), path=require('node:path');
const dir=process.argv[2];
for (const [file,anchor,row] of [
  ['catalog.js'," ['egfr',"," ['blood-pressure','血壓監測','遊戲','/health/blood-pressure/'],"],
  ['health-game.controller.js',"    { id: 'egfr',","    { id: 'blood-pressure', title: '血壓監測', kind: '遊戲', href: '/health/blood-pressure/' },"]
]) {
  const target=path.join(dir,file), source=fs.readFileSync(target,'utf8');
  if(source.split(anchor).length!==2)throw Error('Missing catalog entry in '+file);
  fs.writeFileSync(target,source.replace(anchor,row+'\n'+anchor));
}
