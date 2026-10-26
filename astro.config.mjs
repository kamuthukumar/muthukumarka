import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://kamuthukumar.github.io",
  base: "/muthukumarka",
  trailingSlash: "ignore",
  build: { inlineStylesheets: "always" },
});
