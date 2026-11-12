// This factory is shared by both applications. Each supplies its authenticated API client.
export function createContractRenewal(React) {
  const view = React.createElement;
  return function ContractRenewal({state, admin, save, reload, disabled=false}) {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const lock = React.useRef(false);
    const request = React.useRef({hash:'', key:''});
    if (!state || !state.requiresRefresh) return null;
    const contract = state.current;
    const allowed = state.canRefresh === true;
    const ready = allowed && !!(state.snapshotHash && contract && contract.id && contract.contentHash);
    async function apply() {
      if (!ready || lock.current) return;
      lock.current = true;
      setBusy(true);
      setError('');
      const payload = {expectedSnapshotHash:state.snapshotHash, contractVersionId:contract.id, contentHash:contract.contentHash, confirmed:true};
      const signature = JSON.stringify(payload);
      if (request.current.hash !== signature) request.current = {hash:signature, key:crypto.randomUUID()};
      try {
        await save(payload, request.current.key);
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : '暫時無法更新協議，請重試。');
      } finally {
        lock.current = false;
        setBusy(false);
      }
    }
    return view('section',{className:'card contract-renewal', 'aria-label':'新版會員協議','aria-busy':busy},
      view('h4',null,'協議已更新，請重新確認並簽名'),
      view('p',null,!allowed ? '請聯絡承辦人核對紙本協議及簽署流程。' : admin
        ? '這份申請需要簽署新版協議。更新後會沿用已填資料與已上傳的證件，請取得會員簽署的新版文件。'
        : '已填資料與已上傳的證件會沿用。請切換至新版協議，閱讀後再簽名。'),
      contract && view('p',null,contract.title,' · ',contract.version),
      contract && contract.content && view('details',null,
        view('summary',null,'查看新版協議全文'),view('p',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},contract.content)),
      error && view('p',{role:'alert'},error),
      ready ? view('button',{type:'button',className:'primary',disabled:disabled||busy,onClick:apply},
        busy?'正在更新協議…':(admin?'將本案切換至新版協議':'切換至新版協議並繼續簽名'))
        : allowed && view('p',{role:'status'},'目前無法取得新版協議，請重新載入。'),
      error && view('button',{type:'button',disabled:disabled||busy,onClick:reload},'重新讀取版本')
    );
  };
}
