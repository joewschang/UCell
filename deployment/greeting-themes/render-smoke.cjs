const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),api=path.join(root,'backend/apps/api');
const {Resvg}=require(require.resolve('@resvg/resvg-js',{paths:[api]}));
const {greetingSvg,greetingCopy}=require(path.join(api,'dist/modules/daily-greetings/daily-greeting'));
const {greetingTheme}=require(path.join(api,'dist/modules/daily-greetings/greeting-art'));
const logo='data:image/jpeg;base64,'+fs.readFileSync(path.join(api,'src/modules/daily-greetings/assets/ucell-official-logo.jpeg')).toString('base64');
const out=path.join(__dirname,'evidence');fs.mkdirSync(out,{recursive:true});
const font={fontFiles:[process.env.DAILY_GREETING_FONT_PATH],loadSystemFonts:false,defaultFontFamily:'Noto Sans CJK TC'};
let panels=[],records=[];
for(const [i,date] of ['2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15','2026-11-16','2027-02-06'].entries()){
 const png=new Resvg(greetingSvg(date,logo),{font}).render().asPng();assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1080);assert(png.length<600000);
 const theme=greetingTheme(date,greetingCopy(date).category==='節慶');fs.writeFileSync(path.join(out,theme+'.png'),png);
 panels.push(`<image x="${i%4*405}" y="${Math.floor(i/4)*405}" width="405" height="405" href="data:image/png;base64,${png.toString('base64')}"/>`);records.push({date,theme,bytes:png.length});
}
fs.writeFileSync(path.join(out,'contact-sheet.png'),new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1620" height="810">${panels.join('')}</svg>`).render().asPng());
fs.writeFileSync(path.join(out,'render.json'),JSON.stringify(records,null,2));console.log(JSON.stringify(records));
