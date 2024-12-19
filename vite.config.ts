import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [react(), topLevelAwait()],
  define: {
    // By default, Vite doesn't include shims for NodeJS/
    // necessary for zarr-js to work
    global: {},
  },
})
