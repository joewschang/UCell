const fs = require('node:fs');
const path = require('node:path');
const dir = process.argv[2];
for (const [name, before, row] of [
  ['catalog.js', " ['blood-pressure',", " ['cognition','失智/輕度認知障礙評估','遊戲','/health/cognition/'],"],
  ['health-game.controller.js', "    { id: 'blood-pressure',", "    { id: 'cognition', title: '失智/輕度認知障礙評估', kind: '遊戲', href: '/health/cognition/' },"]
]) {
  const file = path.join(dir, name);
  const source = fs.readFileSync(file, 'utf8');
  if (source.split(before).length !== 2) throw Error('找不到預期的遊戲目錄 '+name);
  fs.writeFileSync(file, source.replace(before, row+'\n'+before));
}
