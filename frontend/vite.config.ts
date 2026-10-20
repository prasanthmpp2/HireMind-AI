import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const resolveBasePath = () => {
  if (!process.env.GITHUB_ACTIONS) return "/";
  const repository = process.env.GITHUB_REPOSITORY || "";
  const repoName = repository.split("/")[1];
  return repoName ? `/${repoName}/` : "/";
};

export default defineConfig({
  // Use repository subpath when building on GitHub Actions for Pages.
  base: resolveBasePath(),
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      "/api/v1": {
        target: process.env.HIREMIND_API_PROXY_TARGET || "http://localhost:5001",
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"]
  }
});
