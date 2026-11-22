import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // PixiJS makes the main chunk ~580 kB (~180 kB gzipped); that is expected for a game.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
  },
});
