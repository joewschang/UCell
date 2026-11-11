/** Versioned, reviewed copy. No member data, health claims or monetary rules. */
export const GREETING_VERSION='template-v1';
export const TIME_ZONE='Asia/Taipei';
const DAY=86_400_000;
export function greetingDate(now=new Date()) { return new Date(now.getTime()+8*3_600_000-7*3_600_000).toISOString().slice(0,10); }
export function greetingWindow(date:string) {
 const availableAt=new Date(date+'T07:00:00+08:00');
 return {availableAt:availableAt.toISOString(),nextRefreshAt:new Date(availableAt.getTime()+DAY).toISOString()};
}
export function validGreetingDate(date:string,now=new Date()) {
 return /^\d{4}-\d{2}-\d{2}$/.test(date)&&date>='2026-01-01'&&date<=greetingDate(now)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
}
export type GreetingCopy={category:'早安'|'問好'|'祝福'|'提醒'|'節慶';title:string;lines:readonly string[]};
const ordinary:readonly GreetingCopy[]=[
 {category:'早安',title:'早安，美好的一天',lines:['讓陽光照進心裡','帶著微笑，迎接今天的美好']},
 {category:'問好',title:'一聲問候，一份溫暖',lines:['把關心送給在乎的人','願你今天有好心情']},
 {category:'祝福',title:'願你平安，日日美好',lines:['把每個小小的美好收藏','讓幸福在生活裡慢慢發光']},
 {category:'提醒',title:'早安，記得照顧自己',lines:['忙碌之間，也留一點空白','喝口水、伸個懶腰，再出發']},
 {category:'早安',title:'新的一天，從心開始',lines:['不用著急，照自己的步調','一步一步，走向喜歡的生活']},
 {category:'祝福',title:'把美好，分享給你',lines:['願今天的努力都有回響','願身邊的人都平安喜樂']},
 {category:'問好',title:'早安，今天也要微笑',lines:['一個笑容，一句問候','都能讓彼此的日子更溫暖']},
 {category:'提醒',title:'留點時間，給美好',lines:['抬頭看看天空，感受微風','也別忘了問候重要的人']},
 {category:'祝福',title:'心有暖陽，歲月有光',lines:['珍惜相伴的每個日常','願你所遇皆溫柔，所行皆順心']},
 {category:'早安',title:'早安，讓希望發芽',lines:['用心過好今天','小小的進步，也值得為自己鼓掌']},
 {category:'問好',title:'把今天，過成喜歡的樣子',lines:['一份好心情，從問候開始','願你今天自在、順心']},
 {category:'提醒',title:'早安，給自己一點鼓勵',lines:['做得到的事，就慢慢做好','累了歇一會，再繼續前行']},
];
const holiday=(title:string,...lines:string[]):GreetingCopy=>({category:'節慶',title,lines});
export function greetingCopy(date:string):GreetingCopy {
 const day=new Date(date+'T12:00:00+08:00'),md=date.slice(5);
 const fixed:Record<string,GreetingCopy>={
  '01-01':holiday('新年好，萬象更新','願新的一年，平安順心','把嶄新的希望，送給最重要的你'),
  '08-08':holiday('父親節，謝謝您的守護','把平時沒說出口的感謝','化成今天最溫暖的祝福'),
  '09-28':holiday('教師節，感謝有您','謝謝每一份耐心與引領','祝福所有老師平安喜樂'),
  '10-10':holiday('雙十佳節，平安美好','願每個平凡日常','都有值得珍惜的幸福'),
  '12-25':holiday('聖誕快樂，溫暖相伴','願祝福點亮你的日常','讓愛與平安陪伴每個人'),
 };
 if(fixed[md])return fixed[md];
 if(md.slice(0,2)==='05'&&day.getUTCDay()===0&&Number(md.slice(3))>=8&&Number(md.slice(3))<=14)return holiday('母親節，謝謝您的愛','把最溫柔的祝福送給媽媽','願您每天都被幸福圍繞');
 // Verified against HKO Gregorian/lunar conversion tables for 2026 and 2027.
 // Never infer lunar observances with ICU: Node 24's 2027 New Year is one day late.
 // Unreviewed years keep ordinary/fixed-date greetings until this table is extended.
 const lunarDates:Record<string,string>={
  '2026-02-17':'new-year','2026-03-03':'lantern','2026-06-19':'dragon','2026-09-25':'moon',
  '2027-02-06':'new-year','2027-02-20':'lantern','2027-06-09':'dragon','2027-09-15':'moon',
 };
 const lunar=lunarDates[date];
 if(lunar==='new-year')return holiday('新春如意，福氣滿滿','願新的一年，闔家平安','好事相伴，喜樂常在');
 if(lunar==='lantern')return holiday('元宵佳節，團圓美好','一盞燈，一份祝福','願你與家人平安喜樂');
 if(lunar==='dragon')return holiday('端午安康，幸福相伴','把關心包進祝福裡','願你與家人平安順心');
 if(lunar==='moon')return holiday('中秋團圓，月滿人安','明月寄相思，問候送溫暖','願你與所愛之人幸福相伴');
 return ordinary[Math.floor(Date.parse(date+'T00:00:00Z')/DAY)%ordinary.length];
}
export const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function greetingSvg(date:string,logoDataUri:string):string {
 if(!logoDataUri.startsWith('data:image/jpeg;base64,'))throw new Error('GREETING_OFFICIAL_LOGO_REQUIRED');
 const copy=greetingCopy(date),index=Math.floor(Date.parse(date+'T00:00:00Z')/DAY);
 const palettes=[['#eff8f3','#143f3e','#97b5a3','#e5b76b'],['#fff5e4','#624a34','#d2a678','#eecf85'],['#eef3fa','#284763','#94b0be','#e6bd80'],['#fcf0ee','#704849','#c9999a','#e8b983']];
 const [bg,ink,leaf,sun]=palettes[index%palettes.length];
 const font='Noto Sans CJK TC';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="1080" height="1080" fill="url(#sky)"/><circle cx="860" cy="245" r="110" fill="${sun}" opacity=".65"/><circle cx="860" cy="245" r="144" fill="none" stroke="${sun}" opacity=".25" stroke-width="2"/><path d="M0 790 Q240 640 480 795 T1080 755 V1080 H0Z" fill="${leaf}" opacity=".24"/><path d="M0 890 Q270 760 560 880 T1080 830 V1080 H0Z" fill="${leaf}" opacity=".4"/><path d="M0 990 Q290 865 610 960 T1080 930 V1080 H0Z" fill="${ink}" opacity=".10"/><g transform="translate(0 180)" fill="none" stroke="${ink}" stroke-width="4" opacity=".45"><path d="M85 880 Q175 750 105 580"/><path d="M108 747 Q68 705 65 653 Q127 677 108 747Z" fill="${leaf}"/><path d="M122 797 Q181 756 187 713 Q125 724 122 797Z" fill="${leaf}"/><path d="M1010 920 Q918 814 960 700"/><path d="M957 805 Q1015 775 1018 736 Q959 748 957 805Z" fill="${leaf}"/></g><g font-family="${font}" fill="${ink}"><image href="${logoDataUri}" x="60" y="10" width="560" height="315" preserveAspectRatio="xMidYMid meet"/><rect x="80" y="350" width="116" height="43" rx="21" fill="${ink}" opacity=".08"/><text x="138" y="380" font-size="24" text-anchor="middle">${escapeHtml(copy.category)}</text><text x="80" y="474" font-size="60" font-weight="700">${escapeHtml(copy.title)}</text>${copy.lines.map((line,i)=>`<text x="84" y="${560+i*58}" font-size="33">${escapeHtml(line)}</text>`).join('')}<path d="M84 683 H184" stroke="${ink}" stroke-width="3" opacity=".4"/><text x="84" y="744" font-size="24" letter-spacing="2">${date.replaceAll('-',' . ')}</text><text x="540" y="1008" font-size="25" text-anchor="middle" letter-spacing="3">UCell｜每日一份溫暖</text></g></svg>`;
}
