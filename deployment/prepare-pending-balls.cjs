const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),dest='C:/UCell/pending-balls-20261023/admin';
fs.mkdirSync(dest,{recursive:true});
fs.cpSync(root+'/admin/dist',dest+'/dist',{recursive:true});
fs.writeFileSync(dest+'/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:d02e657dedc838c57148e0580befe131df7633d28c300a958ff10192bcd2d874\nCOPY dist/ /usr/share/nginx/html/\n');
