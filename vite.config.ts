import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  optimizeDeps: {
    include: ['lucide-react'],
  },
  define: {
    // STRIPE_PUBLISHABLE_KEYをクライアント側で使用できるように定義
    'import.meta.env.STRIPE_PUBLISHABLE_KEY': JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY || ''),
  },
  build: {
    // 環境変数の情報をビルドログに出力（デバッグ用）
    reportCompressedSize: true,
    // CSP対応のための設定
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;",
    },
  },
});
