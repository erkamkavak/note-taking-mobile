import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external access
    port: 5173,       // Specify port (optional)
    watch: {
      usePolling: false, // Disable polling for better stability
      interval: 1000,
    },
    hmr: {
      overlay: false, // Disable HMR overlay on external devices
    },
  },
})
