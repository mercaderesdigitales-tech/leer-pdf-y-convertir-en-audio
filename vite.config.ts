import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function mespeakEncodingPlugin(): Plugin {
  return {
    name: 'mespeak-encoding-fix',
    load(id) {
      if (id.includes('ESpeak.js')) {
        try {
          return fs.readFileSync(id, 'latin1');
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [mespeakEncodingPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || process.cwd(), '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 2500,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
