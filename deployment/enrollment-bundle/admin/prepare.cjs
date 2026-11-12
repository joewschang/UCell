const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const admin=path.resolve(__dirname,'../../../admin');
const project=createRequire(path.join(admin,'package.json'));
const esbuild=createRequire(project.resolve('vite/package.json'))('esbuild');
const aliases={
  'react':'export const {useState,useRef}=UCellReviewHost.React;',
  'react/jsx-runtime':'export const {jsx,jsxs,Fragment}=UCellReviewHost.jsx;',
  '@tanstack/react-query':'export const useQuery=UCellReviewHost.query;',
  '../auth/auth':'export const useAuth=UCellReviewHost.auth;',
  '../../lib/api':'export const {get,command}=UCellReviewHost;',
  '../../lib/format':'export const {dateTime}=UCellReviewHost;',
  '../../components/ConfirmAction':'export const {ConfirmAction}=UCellReviewHost;',
  '../../components/ui':'export const {ErrorBox,Field}=UCellReviewHost;'
};
async function run(out) {
  const result=await esbuild.build({stdin:{contents:"export {EnrollmentReview} from './src/features/applications/EnrollmentReview'; export {EnrollmentBundleReceipt} from './src/features/orders/EnrollmentBundleReceipt';",resolveDir:admin},
    bundle:true,write:false,format:'iife',jsx:'automatic',charset:'utf8',target:'es2020',minify:true,
    globalName:'UCellGroupReview',loader:{'.css':'empty'},plugins:[{name:'admin-shell',setup(b){
      b.onResolve({filter:/.*/},a=>Object.hasOwn(aliases,a.path)?{namespace:'host',path:a.path}:undefined);
      b.onLoad({filter:/.*/,namespace:'host'},a=>({contents:aliases[a.path]}));
    }}]});
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'extension.js'),result.outputFiles[0].text);
  fs.copyFileSync(path.join(admin,'src/features/applications/enrollment-review.css'),path.join(out,'review.css'));
  for(const file of ['assemble.cjs','Dockerfile'])fs.copyFileSync(path.join(__dirname,file),path.join(out,file));
}
if(require.main===module)run(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1});
