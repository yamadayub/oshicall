import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// STRIPE_PUBLISHABLE_KEYをVITE_STRIPE_PUBLISHABLE_KEYにマッピング（VITE_プレフィックスなしで設定されている場合）
if (process.env.STRIPE_PUBLISHABLE_KEY && !process.env.VITE_STRIPE_PUBLISHABLE_KEY) {
  process.env.VITE_STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  optimizeDeps: {
    include: ['lucide-react'],
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
