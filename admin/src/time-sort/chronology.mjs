// Date-only and unqualified clock values in the operations UI are Taipei civil time.
export function timeValues(input) {
  const text = String(input ?? '').normalize('NFKC').replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,'$3-$1-$2');
  const pattern = /(?<![\dA-Za-z])(?:(民國)\s*)?(\d{3,4})\s*[-/.年]\s*(\d{1,2})(?:\s*[-/.月]\s*(\d{1,2})(?:日)?)?(?:[ T,，]*(?:(上午|下午|中午|正午|午夜|凌晨|清晨|早上|傍晚|晚上|半夜|夜間|AM|PM)\s*)?(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(AM|PM)?\s*(Z|[+-]\d{2}:?\d{2})?)?(?!\d)/gi;
  const times = [];
  for (const m of text.matchAll(pattern)) {
    const year = Number(m[2]) + (m[1] || m[2].length === 3 ? 1911 : 0);
    const month = Number(m[3]), day = Number(m[4] || 1);
    let hour = Number(m[6] || 0);
    const minute = Number(m[7] || 0), second = Number(m[8] || 0);
    const meridiem = m[5] || m[10];
    if (meridiem) {
      if (hour < 0 || hour > 12) continue;
      hour = hour % 12 + (/下午|中午|正午|傍晚|晚上|夜間|pm/i.test(meridiem) ? 12 : 0);
    }
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year,month,0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) continue;
    const zone = m[11];
    let offset = 480;
    if (zone && /^Z$/i.test(zone)) offset = 0;
    else if (zone) {
      const z = zone.replace(':','');
      offset = (Number(z.slice(1,3))*60 + Number(z.slice(3))) * (z[0] === '-' ? -1 : 1);
    }
    times.push(Date.UTC(year,month-1,day,hour,minute,second,Number(((m[9] || '')+'000').slice(0,3))) - offset*60000);
  }
  return times;
}
export function timeLabel(label) {
  return /時間|日期|起始|起點|截止|到期|最後更新|最早證據|上次鼓勵|最後登入|有效期間|加入月份|發生月份|交易月份|生效月份|潛客月份|(?:^|[ （(])(?:time|date|last updated|created at|updated at)\b/i.test(String(label));
}
export function compareTime(a,b,descending=false) {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return descending ? b-a : a-b;
}
export function sortRendered(rows, read, descending) {
  return rows.map((row,index) => ({row,index,time:read(row)}))
    .sort((a,b) => compareTime(a.time,b.time,descending) || a.index-b.index).map(x=>x.row);
}
