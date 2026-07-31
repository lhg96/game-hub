import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    allowedHosts: true, // ngrok/cloudflare 등 임의 호스트헤더 허용
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  preview: {
    host: true,
    allowedHosts: true, // ngrok/cloudflare 등 임의 호스트헤더 허용
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  },
});
