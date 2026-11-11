export const stations = [
  {
    title:'腰圍量測', prompt:'自然站立，找到最下方肋骨和骨盆上緣的中點，用軟尺水平繞一圈。正常吐氣結束時讀取公分數。',
    note:'圖中肚臍僅示意繞尺方向。請以肋骨與骨盆的中點為準。成人腰圍參考值為男性 90、女性 80 公分。',
    choices:['低於參考值','達到或超過參考值'],
    advice:['','記下腰圍與量測日期，下次健檢時一起討論血糖篩檢。']
  },
  {
    title:'家族糖尿病史', prompt:'回想有血緣關係的家人。若父母或兄弟姊妹也有糖尿病，請選第三項。',
    choices:['據我所知都沒有','祖父母或外祖父母有','父母或兄弟姊妹有'],
    advice:['','記下患病家人和自己的關係，下次健檢時告訴醫療人員。','告知醫療人員你的父母或手足有糖尿病，討論適合你的血糖檢查時機。']
  },
  {
    title:'夜尿與口渴', prompt:'和平常相比，最近是否更常起床上廁所、尿量變多，或白天一直覺得口渴？',
    choices:['沒有明顯變化','偶爾有這些情形','經常或持續發生'],
    advice:['','可記下夜間上廁所的次數、口渴及持續時間。','請儘早安排門診，告知口渴或排尿變化，並詢問是否需要驗血糖。']
  },
  {
    title:'飯後精神', prompt:'想想最近幾次吃完正餐後，你的精神和清醒程度如何？',
    choices:['精神和平常差不多','偶爾想睡','常常很睏，已影響日常活動'],
    advice:['','可以記下哪一餐後容易想睡，以及前一晚的睡眠情形。','記下飯後嗜睡的時間與程度，帶到門診討論可能原因。']
  },
  {
    title:'手腳感覺與傷口', prompt:'最近手腳是否有麻木、刺痛，或注意到小傷口比平常更慢癒合？',
    choices:['沒有注意到這些情形','偶爾有短暫的麻刺感','持續麻刺，或有傷口一直沒好'],
    advice:['','記下麻刺的部位及持續時間；若反覆發生，可安排門診。','請儘早讓醫療人員評估持續麻刺或未癒傷口。若傷口紅腫擴大、化膿或伴隨發燒，請及時就醫。']
  },
  {
    title:'每週活動與久坐', prompt:'回想平常一週。中等強度活動例如能說話、但不容易唱歌的快走。',
    choices:['每週達 150 分鐘，也經常起身','有活動，但未達 150 分鐘或常久坐','大多坐著，很少活動'],
    advice:['','選一段日常坐得最久的時間，安排起身走動。','從體力許可的短程活動開始，逐步累積；有活動限制時可請醫療人員協助規劃。']
  }
];
export const skip = '不確定或略過這題';
export function summarize(answers) {
  const observed = stations.flatMap((s,i) => s.choices[answers[i]] === undefined ? [] : [i]);
  const attention = observed.filter(i => answers[i] > 0);
  const priority = [2,4,3].filter(i => answers[i] === 2);
  const ordered = [...new Set([...priority,...attention])];
  const title = priority.length ? '這些變化值得安排門診討論' : !observed.length ? '這次先熟悉了觀察方法' :
    attention.length ? '從這些日常觀察開始' : '已回答的項目沒有勾選提醒情形';
  return {title, count:observed.length, advice:ordered.map(i=>[stations[i].title,stations[i].advice[answers[i]]])};
}
