import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import glsl from "vite-plugin-glsl";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [mkcert(), glsl(), react()],
  server: {
    host: true, // Allows access from the network
    proxy: {
      '/r2': {
        target: 'https://pub-4dc5824a7d6645b29006348054fb1f3f.r2.dev',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/r2/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': '/webfiles'
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        experience: resolve(__dirname, 'experience.html'),
        sceneSelect: resolve(__dirname, 'scene-select.html'),
      }
    }
  },
  envDir: './WebFiles'
});
