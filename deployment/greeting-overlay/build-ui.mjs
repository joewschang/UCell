import {createRequire} from 'node:module';import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
for(const kind of ['member','admin']){
 const root=path.resolve(here,'../../'+kind);const req=createRequire(root+'/package.json');const {build}=req('vite');
 await build({root,configFile:false,resolve:{alias:{'react':path.join(root,'node_modules/react'),'react-dom':path.join(root,'node_modules/react-dom'),'@tanstack/react-query':path.join(root,'node_modules/@tanstack/react-query')}},define:{'process.env.NODE_ENV':'"production"','import.meta.env.VITE_API_BASE_URL':JSON.stringify('https://api.ucell.life/api/v1'),'import.meta.env.VITE_ENABLE_DEMO_LOGIN':'"false"'},esbuild:{jsx:'automatic'},build:{outDir:path.join(here,'output',kind,'greetings'),emptyOutDir:true,lib:{entry:path.join(here,kind+'-entry.tsx'),name:'UCellGreeting',formats:['iife'],fileName:()=> 'entry.js'},rollupOptions:{output:{assetFileNames:'[name][extname]'}}}});
}

const fs=await import('node:fs');for(const [source,target] of [['admin-index.html','index.html'],['admin.css','admin.css'],['admin-link.js','link.js']])fs.copyFileSync(path.join(here,source),path.join(here,'output/admin/greetings',target));
