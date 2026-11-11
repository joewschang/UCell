export const title='肌少症自我檢測';
export const stations=[
  {title:'小腿指環測試',prompt:'坐穩、放鬆，用兩手的拇指和食指圍圈，輕套在小腿最粗處。手指的位置如何？',choices:['指尖碰不到，圈不住小腿','指尖剛好相碰','指尖重疊，圈內有空隙'],points:[20,10,0],tip:'記下小腿圍的變化；若近期變細或體重下降，可和醫療人員討論。'},
  {title:'五次起立坐下',prompt:'依平常經驗作答即可。若能安全獨立起身，可用靠牆的穩固椅子，抱胸起立、坐下五次。需要支撐就停下。',choices:['不用手撐，少於 12 秒完成','不用手撐，12 秒以上完成','需要支撐、協助或無法完成'],points:[20,10,0],tip:'若起身較費力，可請物理治療師評估適合你的坐站練習。'},
  {title:'提起約 5 公斤的物品',prompt:'回想提一袋 5 公斤米或一桶水時的感覺。直接按經驗回答即可。',choices:['能平穩提起','能提起，但有些吃力','很困難或需要別人幫忙'],points:[15,8,0],tip:'提物時可分裝、減輕每次重量；若提物能力持續下降，請與醫療人員討論。'},
  {title:'室內平地行走',prompt:'回想最近在客廳或走廊走一小段路的情形。請照常使用你的輔具。',choices:['步伐平穩，可以自行走動','偶爾要扶家具或放慢腳步','需要輔具或他人攙扶，或無法行走'],points:[15,8,0],tip:'保持走道明亮、移開障礙物。若經常走不穩，可安排步態與平衡評估。'},
  {title:'走上 10 階樓梯',prompt:'回想平常走上約十階樓梯的感覺，毋須現在試爬。可以照常扶扶手。',choices:['能輕鬆走完','能走完，但吃力或需中途休息','非常困難、需人協助或無法完成'],points:[15,8,0],tip:'上下樓使用扶手，依自己的速度行走；若比以前更吃力，可在回診時提出。'},
  {title:'過去一年跌倒紀錄',prompt:'回想過去 12 個月，曾意外跌坐或倒在地面上幾次？只絆了一下但站穩，無須計入。',choices:['沒有跌倒','跌倒 1～3 次','跌倒 4 次以上'],points:[15,7,0],tip:'記下跌倒次數、地點和當時情況，帶給醫療人員討論防跌措施。'}
];
export function summarize(answers){
  const scored=stations.filter((s,i)=>s.points[answers[i]]!==undefined);
  const total=scored.length===stations.length?stations.reduce((n,s,i)=>n+s.points[answers[i]],0):null;
  const advice=stations.filter((s,i)=>answers[i]===2||(answers[i]===1&&i!==0)).map(s=>s.tip);
  return {total,count:scored.length,advice,heading:total===null?'這次的觀察紀錄':total>=80?'完成六項日常觀察':total>=50?'記下較吃力的動作':'帶著紀錄安排專業評估'};
}
