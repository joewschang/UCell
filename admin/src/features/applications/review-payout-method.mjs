export function createReviewPayoutMethod(React) {
  const {createElement: h, useState, useRef} = React;
  const labels = {BANK_TRANSFER:'銀行匯款', COMPANY_CASH:'至公司領現金'};
  return function ReviewPayoutMethod({detail, canEdit, blocked, setBusy, save, reload}) {
    const method = detail.payoutMethod;
    const version = detail.payoutMethodVersion;
    const [choice, setChoice] = useState(method);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const pending = useRef(false);
    const editable = canEdit && ['DRAFT','NEEDS_MORE_INFO','SUBMITTED','UNDER_REVIEW'].includes(detail.status);
    async function submit() {
      if (pending.current || blocked || !editable || choice === method || !labels[choice]) return;
      pending.current = true;
      setBusy(true);
      setSaving(true);
      setError('');
      setMessage('');
      try {
        await save('/admin/formal-member-applications/'+encodeURIComponent(detail.id)+'/payout-method', {
          method:choice, expectedMethod:method, expectedVersion:version
        });
        setMessage('已儲存獎金領取方式。');
      } catch (e) {
        setError(e?.status === 409 ? '此案資料已更新，請核對最新領取方式後再儲存。' : (e?.message || '無法儲存領取方式，請稍後重試。'));
      } finally {
        try { await reload(); } finally { pending.current=false; setSaving(false); setBusy(false); }
      }
    }
    if (!Object.hasOwn(labels,method) || !Number.isSafeInteger(version))
      return h('section',{className:'card'},h('h3',null,'獎金領取方式'),
        h('p',{role:'status'},'暫時無法確認本案領取方式。'),
        h('button',{type:'button',disabled:blocked,onClick:reload},'重新讀取'));
    return h('section',{className:'card','aria-label':'獎金領取方式'},
      h('h3',null,'獎金領取方式'),
      h('p',null,'目前方式　',h('strong',null,labels[method])),
      method === 'COMPANY_CASH' && h('p',null,'會員到公司領取獎金，本案免附銀行帳戶與存摺照片。'),
      editable && h('div',{className:'button-row'},
        h('label',null,'領取方式　',h('select',{value:choice,disabled:saving||blocked,onChange:e=>{
          setChoice(e.target.value); setError(''); setMessage('');
        }},Object.entries(labels).map(([value,label])=>h('option',{key:value,value},label)))),
        h('button',{type:'button',disabled:saving||blocked||choice===method,onClick:submit},saving?'儲存中…':'儲存領取方式')),
      editable && choice !== method && h('p',null,choice === 'COMPANY_CASH'
        ? '儲存後，會員可免填銀行資料、免附存摺照片，繼續審核。'
        : '儲存後，審核須核對銀行資料及存摺證明。'),
      message && h('p',{role:'status'},message),error && h('p',{role:'alert'},error));
  };
}
