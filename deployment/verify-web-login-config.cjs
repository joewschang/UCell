const fs=require('fs'),path=require('path');
const app=process.argv[2];if(!['member','admin'].includes(app))throw Error('Expected member or admin');
const root=path.resolve(__dirname,'..',app,'dist'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const entry=html.match(/src="(\/assets\/[^\"]+\.js)"/);if(!entry)throw Error('Entry asset missing');
const js=fs.readFileSync(path.join(root,entry[1]),'utf8');
const values=app==='member'?['2012021712-Dqh6Z8aq','624267916918-10vr4skhkfdtcc9f708sppios9s01tn1.apps.googleusercontent.com']:['0dd08c48-b6e9-4b19-b67a-d3de401f9092','2ed64e97-b7a4-4627-ac8b-44e2b95cef3b','https://admin.ucell.life/login'];
for(const value of ['https://api.ucell.life/api/v1',...values])if(!js.includes(value))throw Error(app+' production login configuration missing: '+value);
console.log(app.toUpperCase()+'_PRODUCTION_LOGIN_CONFIGURATION_VERIFIED');
