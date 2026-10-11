/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { injectCsp } from "./src/csp";

// base "./" makes the build work under any GitHub Pages sub-path.
export default defineConfig({
  base: "./",
  plugins: [react(), { name: "csp-meta", apply: "build", transformIndexHtml: injectCsp }],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
});
