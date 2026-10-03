import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Single master env: read VITE_* from the monorepo root .env instead of
  // looking inside this package. Vite only inlines variables prefixed with
  // VITE_, so the backend credentials in the same file stay out of the bundle.
  envDir: path.resolve(__dirname, ".."),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5176,
    strictPort: true,
  },
})
