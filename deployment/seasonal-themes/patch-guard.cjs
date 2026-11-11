// Display preferences belong to the authenticated person, independently of any qualification.
const fs=require('fs'),file=process.argv[2],src=fs.readFileSync(file,'utf8'),anchor="const request = context.switchToHttp().getRequest(), path = request.url.split('?')[0];";
if(src.split(anchor).length!==2)throw Error('Unexpected context guard');
fs.writeFileSync(file,src.replace(anchor,anchor+"\n        if (path === '/api/v1/member/season-theme' && ['GET','POST'].includes(request.method) && request.user?.personId) return true;"));
