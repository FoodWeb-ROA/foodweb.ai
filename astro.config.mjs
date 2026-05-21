import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://foodweb.ai',
  output: 'static',
  integrations: [react(), mdx()],
  trailingSlash: 'ignore',
  build: {
    assets: '_assets',
  },
  // Dev only: forward /api/* to the local notion-proxy so the contact form
  // works end-to-end with `yarn dev`. In prod this path is served by Firebase
  // Hosting rewriting to the Cloud Run service (see firebase.json).
  vite: {
    server: {
      proxy: {
        '/api': {
          target: process.env.BACKEND_DEV_URL || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  },
});
