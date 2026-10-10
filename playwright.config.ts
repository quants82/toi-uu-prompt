import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const installedChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH || (process.platform === "win32" && existsSync(installedChrome) ? installedChrome : undefined) }
  },
  webServer: { command: "node scripts/browser-server.cjs", url: "http://127.0.0.1:3000", reuseExistingServer: false, timeout: 120000 },
  reporter: "list",
  outputDir: "test-results"
});
