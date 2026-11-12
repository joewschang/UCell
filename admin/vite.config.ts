import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const local=(p:string)=>fileURLToPath(new URL(p,import.meta.url));
const instrument=createRequire(import.meta.url)('../deployment/admin-workflows/sort/instrument.cjs');

export default defineConfig(({mode})=>({
  plugins:[react({jsxImportSource:'@ucell-admin-time'}),{name:'admin-date-list-renderers',enforce:'post',transform(code,id){
    if(!id.split('?')[0].endsWith('.tsx')||!id.replaceAll('\\','/').includes('/admin/src/'))return null;
    const result=instrument(code);return result.count?{code:"import {mapList as ucDateMap} from '/src/time-sort/pages.mjs';\n"+result.code,map:null}:null;
  }}],
  resolve:{alias:{'@ucell-admin-time/jsx-runtime':local('./src/time-sort/jsx-runtime.mjs'),'@ucell-admin-time/jsx-dev-runtime':local('./src/time-sort/jsx-dev-runtime.mjs')},dedupe:['react','react-dom']},
  optimizeDeps:{exclude:['@ucell/design-system']},
  server:{port:4173,proxy:{'/api':{target:process.env.VITE_DEV_API_PROXY ?? loadEnv(mode,process.cwd()).VITE_DEV_API_PROXY ?? 'http://127.0.0.1:3000',changeOrigin:true}}}
}));
