export function contentTopic(row){
  const text=[row.title,row.summary].filter(Boolean).join(' ');
  const topics=[
    ['商品介紹',/TIP[－–—\s-]*\d|商品|產品|晶萃|樂力源|淨衡順/i],
    ['活動與課程',/講座|活動|課程|研習|說明會/],
    ['會員與經營',/會員資格|安置|重銷|推薦|獎金|經營|申請流程/],
    ['健康知識',/健康|營養|飲食|血壓|腎|認知|肌少|血糖|保健/],
    ['品牌故事',/品牌|宇生|企業|公司介紹|UCell/i]
  ];
  return topics.find(([,pattern])=>pattern.test(text))?.[0]??'生活分享';
}
export function orderedTags(tags) {
  const latin=value=>/^[A-Za-z0-9]/.test(value.replace(/^#+/,''));
  const en=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
  const zh=new Intl.Collator('zh-TW-u-co-stroke',{numeric:true});
  return [...tags].sort((a,b)=>Number(latin(b))-Number(latin(a))||(latin(a)?en:zh).compare(a,b));
}

