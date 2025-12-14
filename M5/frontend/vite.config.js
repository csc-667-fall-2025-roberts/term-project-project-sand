import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPath = resolve(__dirname, "src");

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: resolve(__dirname, "dist"),
    rollupOptions: {
      input: {
        index: resolve(rootPath, "index.html"),
        login: resolve(rootPath, "login.html"),
        register: resolve(rootPath, "register.html"),
        game: resolve(rootPath, "game.html"),
      },
    },
  },
  envDir: __dirname,
  plugins: [tailwindcss()],
  publicDir: resolve(__dirname, "public"),
  root: rootPath,
});
