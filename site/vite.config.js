import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "fs";

// GitHub Pages base path must match the repo name.
export default defineConfig({
  plugins: [
    react(),
    // Copy config.json to public directory for runtime access
    {
      name: 'copy-config',
      buildStart() {
        try {
          copyFileSync('./config.json', './public/config.json');
        } catch (err) {
          console.warn('Could not copy config.json:', err.message);
        }
      }
    }
  ],
  // GitHub Pages base path must match repo name so assets resolve correctly.
  base: "/gh-open-dash/"
});