import {el, box, link, show} from './ui.js';
const params = new URLSearchParams(location.search);
if (['play','game','from','read','tag'].some(key => params.has(key))) {
  await import('./sarcopenia.js');
} else {
  const games = [
    ['肌少症自我檢測','跟著六個動作與生活情境，觀察小腿、起身和走路的變化。','./images/station-1.jpg','./?game=sarcopenia'],
    ['糖尿病自我檢測','從腰圍到日常活動，整理自己的血糖相關觀察與下一步。','./diabetes/images/station-1.jpg','./diabetes/']
  ];
  const style = document.createElement('link');
  style.rel='stylesheet'; style.href='./diabetes/game.css'; document.head.append(style);
  show(el('h1','健康中心'), ...games.map(([title, desc, image, href]) => {
    const picture = el('img'); picture.src=image; picture.alt=''; picture.width=1280; picture.height=720;
    const action=link('進入'+title,href,'action');
    return box('section','hub-game',picture,box('div','',el('h2',title),el('p',desc),action));
  }));
}
