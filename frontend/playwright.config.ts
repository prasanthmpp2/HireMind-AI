import { defineConfig, devices } from "@playwright/test";

const apiPort = Number(process.env.HM_E2E_API_PORT || 5511);
const frontendPort = Number(process.env.HM_E2E_FRONTEND_PORT || 5517);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const frontendOrigin = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: frontendOrigin,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"]
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "python run.py",
      cwd: "../backend",
      url: `${apiOrigin}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        FLASK_ENV: "development",
        FLASK_SECRET_KEY: "e2e-only-not-for-deployment",
        AUTH_COOKIE_SECURE: "false",
        PORT: String(apiPort),
        DATABASE_URL: "sqlite:///hiremind-e2e.db",
        CHROMA_PERSIST_DIR: "./chroma_e2e",
        UPLOAD_FOLDER: "./uploads_e2e",
        AI_PROVIDER: "groq",
        GROQ_API_KEY: "",
        HF_TOKEN: "",
        HUGGINGFACE_API_KEY: "",
        FRONTEND_ORIGINS: frontendOrigin
      }
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      url: frontendOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: `${apiOrigin}/api/v1` }
    }
  ]
});
