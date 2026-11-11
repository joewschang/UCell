const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = process.argv[2];
const indexPath = path.join(root, "index.html");
let index = fs.readFileSync(indexPath, "utf8");
const asset = index.match(/src="(\/assets\/[^"]+\.js)"/)[1];
const source = fs.readFileSync(path.join(root, asset), "utf8");
const start = source.indexOf("function Fl({applicationId:");
const end = source.indexOf("async function jm(", start);
if (start < 0 || end < start) throw Error("Signature component changed");
let component = source.slice(start, end);
function replaceOnce(before, after) {
  if (component.split(before).length !== 2) throw Error("Unexpected signature implementation: " + before.slice(0, 50));
  component = component.replace(before, () => after);
}

// Stay inside the LINE webview. Physical rotation can resize the canvas via CSS.
const openStart = component.indexOf("async function se()");
const closeStart = component.indexOf("function me()", openStart);
const effect = component.indexOf("h.useEffect(", closeStart);
if ([openStart, closeStart, effect].includes(-1)) throw Error("Unexpected dialog lifecycle");
replaceOnce(component.slice(openStart, effect), `
function se(){
  if(x || !b.current || !a.current || !w.current || b.current.open) return;
  const context = w.current.getContext("2d");
  context.clearRect(0,0,900,300);
  context.drawImage(a.current,0,0);
  l.current=false;
  F.current=null;
  b.current.showModal();
  M(true);
}
function me(){
  l.current=false;
  F.current=null;
  b.current?.close();
  M(false);
  S.current?.focus({preventScroll:true});
}
`);
const large = component.indexOf('ref:w,width:900,height:300');
const stroke = 'ce.stroke(),c.current+=';
const where = component.indexOf(stroke, large);
if (large < 0 || where < 0) throw Error("Large canvas handler missing");
// Mirror each segment immediately so returning from the modal needs no final copy.
component = component.slice(0, where) + component.slice(where).replace(stroke,
  'ce.stroke();const inline=a.current.getContext("2d");inline.strokeStyle=ce.strokeStyle;inline.lineWidth=ce.lineWidth;inline.lineCap=ce.lineCap;inline.beginPath();inline.moveTo(u.current.x,u.current.y);inline.lineTo(ee.x,ee.y);inline.stroke();c.current+=');
component = component.replaceAll("左手按住畫面，右手簽名。請將左手放在簽名框外，右手在白色框內簽名。","請用一根手指在簽名框內書寫，可點「放大簽名」或將手機橫放。");
replaceOnce('ref:b,className:"signature-dialog"', 'ref:b,onClose:()=>{M(false);l.current=false;F.current=null},className:"signature-dialog"');
const js = source.slice(0,start) + component + source.slice(end);
const hash = data => crypto.createHash("sha256").update(data).digest("hex").slice(0,12);
const newAsset = "/assets/signature-" + hash(js) + ".js";
fs.writeFileSync(path.join(root,newAsset),js);
const css = fs.readFileSync(path.join(__dirname,"signature.css"));
const cssAsset = "/assets/signature-" + hash(css) + ".css";
fs.writeFileSync(path.join(root,cssAsset),css);
fs.writeFileSync(indexPath,index.replace(asset,newAsset).replace("</head>",'<link rel="stylesheet" href="'+cssAsset+'"></head>'));
