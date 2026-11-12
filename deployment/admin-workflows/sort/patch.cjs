'use strict';
const fs=require('node:fs'),path=require('node:path'),instrument=require('./instrument.cjs');
const root=path.resolve(__dirname,'../../../admin/src');
const load=file=>fs.readFileSync(path.join(root,file),'utf8');
function once(code,anchor,value){
  if(code.split(anchor).length!==2)throw Error('Unexpected admin date-sort build anchor: '+anchor.slice(0,80));
  return code.replace(anchor,()=>value);
}
module.exports=function patchTimeSort(entry){
  const decl=['chronology','pages','view'].map(n=>load('time-sort/'+n+'.mjs').replace(/^import .+?;\s*$/gm,'').replace(/^export /gm,'')).join('\n');
  // Isolate module bindings from the identifiers in the minified production shell.
  const integration='const ucDateSort=(()=>{'+decl+'\nreturn {views:createViews(f),mapList,trackRead,renderMeta,timeValues,timeLabel,compareTime,sortRendered};})();const ucDateMap=ucDateSort.mapList;function ucDateElement(type,props,...children){return e.jsx(type,{...props,children:children.length===1?children[0]:children},props?.key)} e={...e,jsx:ucDateSort.views.wrap(e.jsx),jsxs:ucDateSort.views.wrap(e.jsxs)};';
  let js=instrument(entry).code;
  js=once(js,'var f=sf();const cn=DL(f);','var f=sf();'+integration+'const cn=DL(f);');
  js=once(js,'const le=(r,t={})=>Tn(r,t);','const le=async(r,t={})=>ucDateSort.trackRead(r,await Tn(r,t),Tn);');
  js=once(js,'function Jl({ rows, columns, rowId, label, toolbar, searchable = false, rowProps })','function Jl({ rows, columns, rowId, label, toolbar, searchable = false, rowProps, timeSource, adaptTimeRow })');
  js=once(js,'e.jsx(Jl,{rows:c,rowId:h=>h.id,','e.jsx(Jl,{rows:c,timeSource:ucDateSort.renderMeta(i?.props.children),adaptTimeRow:(h,m)=>({id:String(h.key??m),row:h,cells:f.Children.toArray(h.props.children).filter(f.isValidElement)}),rowId:h=>h.id,');
  js=once(js,"    const [sort, setSort] = useState(null);","    const [sort, setSort] = ucDateSort.views.useListSort(label);");
  const a=js.indexOf('    const term = normalize(search);',js.indexOf('function Jl(')),b=js.indexOf('    const visible = columns.filter',a);
  if(a<0||b<0||b-a>1000)throw Error('Unexpected data grid sorting');
  js=js.slice(0,a)+"    const term=normalize(search);const {ordered,remote:timePage}=ucDateSort.views.useGridOrder(rows,columns,sort,term,normalize,timeSource,adaptTimeRow);const filtered=ordered;\n"+js.slice(b);
  js=once(js,"{ className: \"ops-grid-tools\", children: [", "{ className: \"ops-grid-tools\", children: [timePage.pending&&_jsx('span',{role:'status',children:'正在讀取符合篩選的全部資料…'}),timePage.error&&_jsx('span',{role:'alert',children:'完整清單讀取失敗，請重新排序。'}),");
  js=once(js," : 'none', children: _jsx(UCellButton, { onClick: () => {"," : 'none', children: ucDateSort.views.gridHeader(column,sort,setSort,()=>setPage(0),_jsx(UCellButton, { onClick: () => {");
  js=once(js,'}, children: uiValue(column.label) }) }, column.key))','}, children: uiValue(column.label) })) }, column.key))');
  js=once(js,'String(row.greeting_date).slice(0, 10),', 'f.createElement("time",{"data-time-field":"greeting_date",dateTime:String(row.greeting_date).slice(0,10)},"問候日期 ",String(row.greeting_date).slice(0,10)),');
  js=once(js,'rowStatus(row))),','rowStatus(row),f.createElement("br"),f.createElement("time",{"data-time-field":"publish_at",dateTime:row.publish_at||undefined},"發布時間 ",row.publish_at?new Date(row.publish_at).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"}):"—"))),');
  return js;
};
