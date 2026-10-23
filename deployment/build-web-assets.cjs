// For overlays on an existing production image: public files are inherited unchanged.
const path=require('path'),{createRequire}=require('module'),{pathToFileURL}=require('url');
const app=process.argv[2];if(!['member','admin'].includes(app))throw Error('Expected member or admin');
const root=path.resolve(__dirname,'..',app),requireApp=createRequire(path.join(root,'package.json'));
process.env.NODE_ENV='production';
import(pathToFileURL(requireApp.resolve('vite')).href).then(vite=>(vite.build??vite.default.build)({root,build:{copyPublicDir:false,emptyOutDir:false}})).catch(e=>{console.error(e);process.exitCode=1});
