'use strict';
const fs = require('node:fs');
const path = require('node:path');
const [part, root] = process.argv.slice(2);
function edit(file, before, after) {
  const target = path.join(root, file);
  const source = fs.readFileSync(target, 'utf8');
  if (source.split(before).length !== 2) throw Error('Unexpected release base: ' + file + ' / ' + before);
  fs.writeFileSync(target, source.replace(before, () => after));
}
if (part === 'api') {
  edit('catalog.js', " ['guide',", " ['diabetes','糖尿病自我檢測','遊戲','/health/diabetes/'],\n ['guide',");
  edit('catalog.js', "['game','居家腿力與骨骼自我觀察'", "['game','肌少症自我檢測'");
  edit('health-game.controller.js', "    { id: 'guide',", "    { id: 'diabetes', title: '糖尿病自我檢測', kind: '遊戲', href: '/health/diabetes/' },\n    { id: 'guide',");
  edit('health-game.controller.js', "require('./register')(module.exports);", "require('./register')(module.exports);\nrequire('./diabetes-game')(module.exports);");
} else if (part === 'member') {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const oldEntry = index.match(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"/)[1];
  const entry = fs.readFileSync(path.join(root, oldEntry), 'utf8');
  const caption = '本週任務 · 肌少症自我檢測';
  if (entry.split(caption).length !== 2) throw Error('Unexpected Explore tile');
  const updated = entry.replace(caption, '肌少症自我檢測 · 糖尿病自我檢測');
  const hash = require('node:crypto').createHash('sha256').update(updated).digest('hex').slice(0,14);
  const newEntry = '/assets/health-center-'+hash+'.js';
  fs.writeFileSync(path.join(root, newEntry), updated);
  edit('index.html', oldEntry, newEntry);
  edit('health/index.html', './sarcopenia.js', './hub.js');
  edit('health/index.html', '<title>肌少症自我檢測', '<title>居家健康小遊戲');
  edit('topics/entry.js', "health?q.get('read')||'game'", "path.startsWith('/health/diabetes/')?'diabetes':health?q.get('read')||(q.has('play')||q.has('game')?'game':'')");
} else if (part === 'admin') {
  edit('health/manage.js', "el('h2','肌少症自我檢測')", "el('h2','健康中心遊戲開放設定')");
  edit('health/manage.js', "'累計開始 '+model.stats.started", "'肌少症自我檢測 · 累計開始 '+model.stats.started");
  edit('health/manage.js', "el('small','同一會員", "el('p','糖尿病自我檢測 · 累計開始 '+model.diabetesStats.started+' 人週　／　完成 '+model.diabetesStats.finished+' 人週'),el('small','同一會員");
} else throw Error('Unknown part');
