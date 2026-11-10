export function observationReport(answers, ostai, seconds) {
  const [calf, chair, wall, height] = answers;
  const findings = [];
  const advice = [];
  function note(result, next) { findings.push(result); advice.push(next); }
  if (chair === 1) note('坐站時需要支撐或中途停下', '起身時使用穩固扶手。若最近更常需要用手撐，請與醫師或物理治療師討論腿力與平衡。');
  if (chair === 0 && Number(seconds) >= 12) note('自行完成五次坐站，居家計時達 12 秒', '記下使用的椅子與起身時間。若日常起身也變慢，可將紀錄帶去評估腿力；自行操作計時器可能產生誤差。');
  if (calf === 2) note('指環與小腿之間仍有空隙', '下次用同一側、同一位置觀察小腿。若也有走路變慢或近期非刻意減重，請在看診時一併提出。');
  if (height === 1) note('這次身高比先前實測矮', '記下兩次量測的日期與身高，帶去看診；若同時有持續背痛，請告知醫師。');
  if (wall === 1) note('後腦無法輕鬆靠牆', '保持自然站姿，避免用力把頭往後壓。若姿勢改變或背部不適持續，可安排評估。');
  if (ostai !== null && ostai < -1) note('OSTAi 達到篩檢提醒門檻', '帶著試算值及過去骨折紀錄，與醫師討論是否需要骨密度檢查。');
  const observed = calf < 3 || chair < 2 || wall < 2 || height < 2 || ostai !== null;
  if (!findings.length && observed) {
    if (chair === 0) advice.push(seconds == null ? '本次可自行完成五次坐站。下次可用同一張椅子記錄耗時，比較自己的變化。' : '保留本次坐站時間。下次用同一張穩固椅子、依平常速度進行，方便前後比較。');
    if (height === 0 || wall === 0 || ostai !== null) advice.push('保留有日期的身高紀錄，回診時與醫療人員一起看長期變化。');
    if (calf < 2) advice.push('保持平常能安全進行的活動，下次在同一側小腿觀察指環的鬆緊。');
  }
  if (!observed) advice.push('可以先閱讀動作圖解，等環境安全或有家人陪同時，再選一項適合自己的觀察。');
  return { heading: findings.length ? '這次有值得留意的觀察' : observed ? '已填寫的項目未出現本工具的提醒訊號' : '這次尚無足夠資料判讀', findings, advice };
}
