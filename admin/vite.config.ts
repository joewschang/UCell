import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({mode})=>({
  plugins:[react()],
  optimizeDeps:{exclude:['@ucell/design-system']},
  server:{port:4173,proxy:{'/api':{target:process.env.VITE_DEV_API_PROXY ?? loadEnv(mode,process.cwd()).VITE_DEV_API_PROXY ?? 'http://127.0.0.1:3000',changeOrigin:true}}}
}));
