import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/app/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../dashboard/src", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../../public/app", import.meta.url)),
    emptyOutDir: false,
    sourcemap: false,
    target: "es2022",
  },
});
