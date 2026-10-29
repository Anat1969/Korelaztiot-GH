import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1400,
    rollupOptions: { output: { manualChunks: (id) => (id.includes('maplibre-gl') ? 'maplibre' : undefined) } },
  },
  worker: { format: 'es' },
});
