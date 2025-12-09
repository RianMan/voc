import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '172.16.29.232', // 指定 IP 地址
    proxy: {
      // 当前端请求 /api 时，自动转发到你的本地 Node 后端 (localhost:3000)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});