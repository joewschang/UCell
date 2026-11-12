// Apply the enrollment extension to the verified member entry while retaining its signed-document and LINE flows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const repo=path.resolve(__dirname,'../../..');
const member=path.join(repo,'member'),memberRequire=createRequire(path.join(member,'package.json'));
const esbuild=createRequire(memberRequire.resolve('vite/package.json'))('esbuild');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const original='1f28f34eda608068e0fb622f2402356cf22bbf359b1cfcd605e4585f802d9aac';
const baseDigest='sha256:c9073caecd7bf787ebedac0a861939b9769db0c86e6d8e8172393111284aa481';
const aliases={
  react:'export const {useState,useRef,useEffect}=UCellGroupHost.React',
  'react/jsx-runtime':'export const {jsx,jsxs,Fragment}=UCellGroupHost.jsx',
  'react-router-dom':'export const Link=UCellGroupHost.Link',
  '../memberApi':'export const memberApi=UCellGroupHost.api',
  '../api':'export const MemberApiError=UCellGroupHost.Error',
  '../useResource':'export const useResource=UCellGroupHost.resource',
  '../memberData':'export const {getQualificationPackages,getActiveDurationPackages,getPackageProducts,getPackageQuote,getDeliveryProfile}=UCellGroupHost',
  '../liff':'export const pendingSponsorCandidate=UCellGroupHost.candidate',
  '../DeliveryProfileEditor':'export default UCellGroupHost.deliveryEditor',
  '../BankTransferDetails':'export default UCellGroupHost.bankDetails',
};
async function compile(){
  const output=await esbuild.build({
    stdin:{contents:"export {default as Editor, BundleLaunch as Launch} from './src/enrollment-bundle/EnrollmentBundle'; export {default as Progress, GroupOrderPaymentNote as PaymentNote} from './src/enrollment-bundle/BundleProgress';",resolveDir:member,loader:'tsx'},
    jsx:'automatic',bundle:true,format:'iife',globalName:'UCellEnrollmentBundle',target:'es2020',write:false,minify:true,loader:{'.css':'empty'},
    plugins:[{name:'reuse-live-member-services',setup(build){
      build.onResolve({filter:/.*/},args=>Object.hasOwn(aliases,args.path)?{path:args.path,namespace:'live'}:undefined);
      build.onLoad({filter:/.*/,namespace:'live'},args=>({contents:aliases[args.path]}));
    }}]
  });
  return 'const UCellGroupHost={React:h,jsx:r,Link:te,api:q,Error:Gr,resource:ae,getQualificationPackages:AR,getActiveDurationPackages:TR,getPackageProducts:LR,getPackageQuote:xm,getDeliveryProfile:Yf,candidate:A1,deliveryEditor:lh,bankDetails:lo};\n'+output.outputFiles[0].text;
}
function replace(source,needle,value){
  assert.equal(source.split(needle).length,2,'Member release anchor mismatch: '+needle);
  return source.replace(needle,()=>value);
}
function integrate(source,extension){
  const begin=source.indexOf('function Xm(){'),end=source.indexOf('function ',source.indexOf('children:"返回會員首頁"})]})}',begin)+25);
  assert(begin>0&&end>begin);
  let form=source.slice(begin,end);
  const updates=[
    ['w.current=!0;const T=e.data;', 'w.current=!0;const T=e.data;if(T.bundlePayment&&T.application?.id===new URLSearchParams(window.location.search).get("bundlePayment")){p(4);return}'],
    ['function Xm(){const [pdfKey','function Xm(){const [bundleEditor,setBundleEditor]=h.useState(false),[bundleReceipt,setBundleReceipt]=h.useState(null);const [pdfKey'],
    ['const S=e.data,C=S.paidPackages.length>0','const S=e.data,BP=S.bundlePayment,BM=BP||bundleReceipt,C=BP?BP.rootPaid:S.paidPackages.length>0'],
    ['N=C||!!l&&R.some(T=>T.orderId===u)','N=BM?!!(BP?.rootPaid||BP?.paymentReported):C||!!l&&R.some(T=>T.orderId===u)'],
    [';return S.membershipState===',';const groupPanel=BM&&I?r.jsx(UCellEnrollmentBundle.Progress,{applicationId:I,payment:BP,initial:bundleReceipt||undefined,onRefresh:e.retry,onReleased:()=>{setBundleReceipt(null);setBundleEditor(false);p(3);e.retry()},paymentLink:order=>"/orders/"+encodeURIComponent(order.orderNo||order.orderId)+"/payment"}):null;return S.membershipState==='],
    ['children:"新增會員資格"}),','children:"新增會員資格"}),groupPanel,'],
    [':P?r.jsx(el,{}):',':P?r.jsxs(r.Fragment,{children:[groupPanel,r.jsx(el,{})]}):'],
    ['D===4&&!C&&!R.length?', 'D===4&&!C&&!R.length&&!BM?'],
    ['onClick:()=>p(C?5:R.length?4:3),children:C?"繼續確認送審":R.length?', 'onClick:()=>p(C||BM&&N?5:BM||R.length?4:3),children:C||BM&&N?"繼續確認送審":BM||R.length?'],
    [':f===3&&r.jsxs(r.Fragment,{children:[r.jsx("h2",{children:"選擇會員資格套組"})',':f===3&&BM?r.jsx(A,{onClick:()=>p(4),children:"查看整組訂單與付款"}):f===3&&bundleEditor?r.jsx(UCellEnrollmentBundle.Editor,{plan:bundleEditor,applicationId:I,onClose:()=>setBundleEditor(false),onCreated:receipt=>{setBundleReceipt(receipt);setBundleEditor(false);p(4);e.retry()}}):f===3&&r.jsxs(r.Fragment,{children:[r.jsx("h2",{children:"選擇會員資格套組"})'],
    [':r.jsx(dd,{enrollmentFlow:!0,onCreated:()=>{e.retry(),p(4)}})',':r.jsxs(r.Fragment,{children:[I&&S.application?.sourceChannel==="MEMBER_WEB"&&(S.application?.applicantType??S.draft?.payload?.applicantType)==="INDIVIDUAL"&&["DRAFT","NEEDS_MORE_INFO"].includes(S.application?.status)&&r.jsx(UCellEnrollmentBundle.Launch,{choose:setBundleEditor}),r.jsx(dd,{enrollmentFlow:!0,onCreated:()=>{e.retry(),p(4)}})]})'],
    ['f===4&&r.jsxs("section",{className:"card",children:[r.jsx("h2",{children:"付款與訂單確認"})','f===4&&BM?r.jsxs(r.Fragment,{children:[groupPanel,N&&r.jsx(A,{className:"primary",onClick:()=>p(5),children:"繼續送出申請 →"})]}):f===4&&r.jsxs("section",{className:"card",children:[r.jsx("h2",{children:"付款與訂單確認"})'],
    ['"申請套組：",C?','"申請套組：",BP?BP.qualificationCount+" 顆球，同組送審":C?'],
    ['"付款狀態：",C?', '"付款狀態：",BP?(BP.rootPaid?"合併款項已確認":"已回報合併款項，待核對"):C?'],
    ['ME(I,v.current,C?void 0:', 'ME(I,v.current,BM||C?void 0:'],
  ];
  for(const [key,value] of updates)form=replace(form,key,value);
  form=form.replaceAll('"請先選擇有效訂單與付款方式。"', '(BM?"請先回報這組訂單的合併匯款。":"請先選擇有效訂單與付款方式。")');
  let merged=source.slice(0,begin)+extension+'\n'+form+source.slice(end);
  merged=replace(merged,'function lo({method:e})','function lo({method:e,grouped=false})');
  merged=replace(merged,'r.jsx("p",{children:"請先建立訂單，再依訂單金額匯款。','grouped?r.jsx("p",{children:"匯款後請在本頁回報一次。"}):r.jsx("p",{children:"請先建立訂單，再依訂單金額匯款。');
  const orderAnchor='o&&r.jsxs(r.Fragment,{children:[r.jsxs("p",{children:["會員編號：",((w=o.member)';
  merged=replace(merged,orderAnchor,'o?.enrollmentBundle&&(o.enrollmentBundle.combinedPayment||o.enrollmentBundle.isEntry)?r.jsx(UCellEnrollmentBundle.PaymentNote,{applicationId:o.enrollmentBundle.applicationId}):'+orderAnchor);
  const guidance='),r.jsxs("ol",{className:"pw-steps",children:[';
  return replace(replace(merged,guidance,'),e.bundleBallCount&&r.jsx("p",{children:"本組共 "+e.bundleBallCount+" 球。選定第 1 球的位置後，其餘球會依預排一起安置。"}'+'),r.jsxs("ol",{className:"pw-steps",children:['),
    'children:"選擇安置位置"})]},d.placementReference','children:d.bundleBallCount?"選擇整組 "+d.bundleBallCount+" 球的位置":"選擇安置位置"})]},d.placementReference');
}
async function main(){
  const [htmlFile,entryFile,output]=process.argv.slice(2);
  if(!output)throw Error('Usage: node prepare.cjs <live index.html> <live main.js> <output directory>');
  const html=fs.readFileSync(htmlFile,'utf8'),entry=fs.readFileSync(entryFile,'utf8');
  assert.equal(hash(entry),original,'Current member entry differs; inspect and rebase before building');
  const oldPath=html.match(/<script type="module" crossorigin src="([^"]+)"/)?.[1];
  assert(oldPath?.endsWith(original.slice(0,16)+'.js'));
  const merged=integrate(entry,await compile()),style=fs.readFileSync(path.join(member,'src/enrollment-bundle/bundle.css'),'utf8');
  const jsPath='/assets/enrollment-bundle-'+hash(merged).slice(0,16)+'.js',cssPath='/assets/enrollment-bundle-'+hash(style).slice(0,16)+'.css';
  const htmlOut=replace(replace(html,oldPath,jsPath),'</head>','<link rel="stylesheet" href="'+cssPath+'"></head>');
  const write=(file,data)=>{const target=path.join(output,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data)};
  // Rebuilding a candidate must package only the current immutable entry and its stylesheet.
  const assetDir=path.join(output,'overlay','assets');
  if(fs.existsSync(assetDir))for(const file of fs.readdirSync(assetDir)) {
    if(/^enrollment-bundle-[a-f0-9]{16}\.(js|css)$/.test(file)&&!['/assets/'+file].some(asset=>[jsPath,cssPath].includes(asset))) fs.unlinkSync(path.join(assetDir,file));
  }
  write('overlay'+jsPath,merged);write('overlay'+cssPath,style);write('overlay/index.html',htmlOut);
  write('Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@'+baseDigest+'\nCOPY overlay/ /usr/share/nginx/html/\n');
  write('member-manifest.json',JSON.stringify({baseDigest,baseEntry:oldPath,baseEntrySha256:original,jsPath,jsSha256:hash(merged),cssPath,cssSha256:hash(style)},null,2));
  console.log('Member candidate ready',jsPath,cssPath);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={compile,integrate};
