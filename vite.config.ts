/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin customizado para gerar version.json na build e expor como let globla
const versionPlugin = () => {
  let versionContent = '';

  return {
    name: 'version-plugin',
    config(config: any) {
      const timestamp = Date.now().toString();
      versionContent = JSON.stringify({ version: timestamp });

      // Injeta a versão como variável global para a app
      if (!config.define) config.define = {};
      config.define.__APP_VERSION__ = JSON.stringify(timestamp);

      return config;
    },
    generateBundle() {
      // Cria o ficheiro version.json no diretório de saída
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: versionContent
      });
    }
  };
};

export default defineConfig(({ mode }) => {

  return {
    base: '/',
    root: 'front',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      sourcemap: mode === 'development',
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    envDir: path.resolve(__dirname),
    server: {
      port: 3055,
      host: '0.0.0.0',
      proxy: {
        '/uploads': {
          target: 'http://localhost:3060',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react({
        include: "**/*.{jsx,tsx,ts}",
      }),
      versionPlugin()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'front'),
      },
      extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
      include: ['react', 'react-dom', 'lucide-react'],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['front/test/setup.ts'],
      include: ['front/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'front/test/'],
      },
    },
  };
});
