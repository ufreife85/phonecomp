// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Add this plugin to handle the SSL certificate
  ],
  server: {
    host: true, // This makes the server accessible on your network
    https: true   // This enables the secure server
  }
})