const fs = require('node:fs');
const path = require('node:path');

// The released site includes later dashboard, daily and marketing modules than
// the baseline TypeScript tree. Refuse to rewrite an ambiguous release.
function patchWorkbench(bundle) {
  const source = fs.readFileSync(path.join(__dirname, 'workbench.js'), 'utf8');
  const replaceOnce = (before, after) => {
    if (bundle.split(before).length !== 2) throw new Error('Workbench release anchor mismatch: ' + before.slice(0, 120));
    bundle = bundle.replace(before, () => after);
  };

  const mount = 'function JR(){var o,l;const{user:r}=Et(),t=QR';
  replaceOnce(mount, source + '\nconst opsWorkbench=createOperationsWorkbench({React:f,Link:It,useQuery:Le,get:le,canOpen:Ea,useLocation:Lr,useNavigate:Au});\n' + mount);
  const dashboard = 'e.jsx(jt,{title:"營運總覽",subtitle:L("R1.0B 管理後台 Read Model；數字皆來自 Backend，不使用假資料。")}),e.jsx(pt,{query:n}),t&&e.jsx(De,{error:i.error}),e.jsx(YR,{summary:n.error||(o=n.data)==null?void 0:o.data,compensation:t&&!i.error?(l=i.data)==null?void 0:l.data:void 0,canReadCompensation:t})';
  replaceOnce(dashboard,
    'e.jsx(jt,{title:"營運總覽",actions:Ea(r?.role,"/daily-operations")&&Ea(r?.role,"/marketing")&&e.jsx("a",{className:"opsw-jump",href:"#opsw-growth-title",children:"分享成效 ↓"})}),' +
    'e.jsx(opsWorkbench.Workbench,{role:r?.role}),' +
    'e.jsxs("details",{className:"opsw-detail",open:!(Ea(r?.role,"/daily-operations")||Ea(r?.role,"/marketing"))||void 0,children:[' +
    'e.jsx("summary",{children:"查看會員、訂單與財務概況"}),e.jsx(pt,{query:n}),t&&e.jsx(De,{error:i.error}),' +
    'e.jsx(YR,{summary:n.error?void 0:n.data?.data,compensation:t&&!i.error?i.data?.data:void 0,canReadCompensation:t})]})');
  replaceOnce('function JI({role:r}){var S,b,C,A,R,N,T,_,U;const[t,n]=f.useState("")',
    'function JI({role:r}){var S,b,C,A,R,N,T,_,U;const[t,n]=opsWorkbench.useFilter("category")');
  replaceOnce('g=t||((C=p[0])==null?void 0:C.code)||"",y=Le({queryKey:["daily-items"',
    'g=opsWorkbench.useDailySelection(p,t),y=Le({queryKey:["daily-items"');
  replaceOnce('[u,h]=f.useState("ALL"),[m,p]=f.useState(1),[g,y]=f.useState("MEMBERS")',
    '[u,h]=opsWorkbench.useFilter("segment","ALL"),[m,p]=f.useState(1),[g,y]=f.useState("MEMBERS")');
  return bundle;
}

module.exports = {patchWorkbench};
if (require.main === module) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node workbench/patch.cjs <main-bundle-path>');
  const patched = patchWorkbench(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, patched);
}
