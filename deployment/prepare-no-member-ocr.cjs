const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..'),out='C:/UCell/no-member-ocr-20261023';
for(const [app,digest] of [['admin','ac024ad3306ecc1b05c6df2a265dff9f54e4c1c832875c110943e39fc820f952'],['member','debe540c1869f602c46b2de175d1de2818db9dc264a4390db2e8ca636d64efaf']]){
 const dest=out+'/'+app;fs.mkdirSync(dest,{recursive:true});const src=root+'/'+app+'/dist';
 fs.cpSync(src,dest+'/dist',{recursive:true,filter:p=>app!=='member'||!path.relative(src,p).split(path.sep).includes('ocr')});
 let docker=`FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-${app}@sha256:${digest}\nCOPY dist/ /usr/share/nginx/html/\n`;
 if(app==='member'){fs.copyFileSync(root+'/member/deploy/default.conf',dest+'/default.conf');docker+='COPY default.conf /etc/nginx/conf.d/default.conf\n';}
 fs.writeFileSync(dest+'/Dockerfile',docker);
}
console.log('Prepared frontend releases; API unchanged; member OCR assets excluded.');
