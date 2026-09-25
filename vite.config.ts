import { readFileSync, existsSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const keyPath = 'key.pem';
const certPath = 'cert.pem';

export default defineConfig(() => {
  const https = existsSync(keyPath) && existsSync(certPath)
    ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
    : undefined;

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': __dirname },
    },
    server: {
      https,
      proxy: {
        '/api': 'http://localhost:3001',
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
