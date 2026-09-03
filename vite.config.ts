import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  // Relative so the built site works from a GitHub Pages project subpath
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        rules: resolve(__dirname, "rules.html"),
        mapGenerator: resolve(__dirname, "map-generator.html"),
        costCards: resolve(__dirname, "cost-cards.html"),
      },
    },
  },
});
