import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'development-refresh-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      // React Refresh injects an inline preamble only in the loopback dev server.
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    },
  }],
  base: './',
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    watch: { ignored: ['**/test-artifacts/**', '**/release/**', '**/dist-electron/**', '**/local-data/**'] },
  },
  build: { outDir: 'dist', target: 'chrome156' },
});
