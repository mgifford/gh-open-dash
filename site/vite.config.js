import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages base path must match the repo name.
export default defineConfig({
  plugins: [react()],
  base: "/participation/"
});