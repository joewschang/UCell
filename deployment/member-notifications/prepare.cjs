// Add the inbox fix to the verified member release, including its LINE and enrollment extensions.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');

const member = path.resolve(__dirname, '../../member');
const memberRequire = createRequire(path.join(member, 'package.json'));
const esbuild = createRequire(memberRequire.resolve('vite/package.json'))('esbuild');
const digest = 'sha256:60fcaed73ba138346bbc33c8cf8368c6d5c9776973358a8d9e0975a541992500';
const baseEntry = '/assets/enrollment-bundle-d5eaaa5be1d3e7e9.js';
const baseHash = 'd5eaaa5be1d3e7e9cbb1c32ff31059955b2b01cbddd6eaf01dd6545e2cba6aad';
const htmlHash = '3025ab89ab3162696de5be62ddd110f3f8e9237a09799efc77a7e7bc0c97535b';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

function once(source, anchor, replacement) {
  assert.equal(source.split(anchor).length, 2, 'Unexpected release source for ' + anchor);
  return source.replace(anchor, () => replacement);
}

async function compile() {
  const aliases = {
    react: 'export const {useLayoutEffect}=UCellInboxHost.React',
    'react/jsx-runtime': 'export const {jsx,jsxs,Fragment}=UCellInboxHost.jsx',
    'react-router-dom': 'export const {Link,useLocation}=UCellInboxHost',
  };
  const result = await esbuild.build({
    entryPoints: [path.join(member, 'src/MemberInboxEntry.tsx')],
    bundle: true, format: 'iife', globalName: 'UCellInbox', target: 'es2020',
    write: false, minify: true, jsx: 'automatic',
    plugins: [{name: 'member-inbox-host', setup(build) {
      build.onResolve({filter: /.*/}, args => Object.hasOwn(aliases, args.path)
        ? {path: args.path, namespace: 'live-member'} : undefined);
      build.onLoad({filter: /.*/, namespace: 'live-member'}, args => ({contents: aliases[args.path]}));
    }}],
  });
  return 'const UCellInboxHost={React:h,jsx:r,Link:te,useLocation:Yn};\n' + result.outputFiles[0].text;
}

async function main() {
  const [baseline, output] = process.argv.slice(2);
  assert(baseline && output, 'Usage: node prepare.cjs <existing member web root> <image build context>');
  const html = fs.readFileSync(path.join(baseline, 'index.html'), 'utf8');
  let js = fs.readFileSync(path.join(baseline, baseEntry), 'utf8');
  assert.equal(hash(html), htmlHash);
  assert.equal(hash(js), baseHash);

  js = once(js, 'function zc(e){', 'function zc(e){if(e.pathname==="/notifications"||e.pathname==="/notifications/")return"/notifications";');
  const afterLogin = 'v.mode==="connected"&&sessionStorage.removeItem("ucell_paper_line_intent"),';
  js = once(js, afterLogin, afterLogin + 'v.mode==="connected"&&zc(window.location)==="/notifications"&&e("/notifications",{replace:!0}),');
  js = once(js, 'function h0({q:e}){', await compile() + '\nfunction h0({q:e,context:inboxContext}){const inboxEntryKey=Yn().key;');
  js = once(js, 'ae("messages:"+m+":"+x,', 'ae("messages:"+m+":"+x+":"+inboxEntryKey,');
  js = once(js, 'r.jsx(xt,{title:"訊息中心",q:e}),', 'r.jsx(xt,{title:"通知中心",q:e}),inboxContext,');
  js = once(js, 'r.jsx(xt,{title:"我的帳戶"}),', 'r.jsx(xt,{title:"我的帳戶"}),r.jsx(UCellInbox.MeInboxLink,{}),');
  const mainRef = '{mainRef:d,begin:f}=hT(e,n,s==null?void 0:s.id);';
  js = once(js, mainRef, mainRef + 'const inboxOpen=UCellInbox.useInboxRoute(d),inboxQualification=e||n?undefined:s??undefined;');
  const link = 'className:"notification-link",to:"/notifications",';
  js = once(js, link, link + '"aria-current":inboxOpen?"page":undefined,');
  const main = 'id:"member-main",tabIndex:-1,children:';
  js = once(js, main, main +
    'inboxOpen&&!ad?r.jsx(h0,{q:inboxQualification,context:r.jsx(UCellInbox.InboxScope,{loading:e,error:n,retry:i,children:inboxQualification&&r.jsx(RL,{beforeSelect:f})})},inboxQualification?.id??"personal"):');

  const css = fs.readFileSync(path.join(member, 'src/member-notifications.css'));
  const jsPath = '/assets/member-inbox-' + hash(js).slice(0, 16) + '.js';
  const cssPath = '/assets/member-inbox-' + hash(css).slice(0, 16) + '.css';
  const nextHtml = once(once(html, baseEntry, jsPath), '</head>', '<link rel="stylesheet" href="' + cssPath + '"></head>');
  const write = (file, value) => {
    const target = path.join(output, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, value);
  };
  write('overlay' + jsPath, js);
  write('overlay' + cssPath, css);
  write('overlay/index.html', nextHtml);
  write('Dockerfile', 'FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@' + digest + '\nCOPY overlay/ /usr/share/nginx/html/\n');
  write('manifest.json', JSON.stringify({digest, baseEntry, baseHash, jsPath, cssPath, jsHash: hash(js), cssHash: hash(css), htmlHash: hash(nextHtml)}, null, 2));
  console.log(jsPath, cssPath);
}
main().catch(error => {console.error(error); process.exitCode = 1;});
