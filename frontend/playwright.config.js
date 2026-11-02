import { defineConfig, devices } from '@playwright/test'
import process from 'node:process'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 8000 },
  reporter: [['list'], ['json', { outputFile: process.env.TRENDIT_BROWSER_REPORT || '../backend/artifacts/ui-integration-20261022/browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:15173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: '../.venv/bin/python -m uvicorn api.main:app --app-dir ../backend --host 127.0.0.1 --port 18000',
      url: 'http://127.0.0.1:18000/predict/t0-verified/evaluation',
      env: {
        TRENDIT_T0_RUN_ID: process.env.TRENDIT_TEST_RUN_ID || 't0-v2-cpu-20261022-audit',
        TRENDIT_T0_DIAGNOSTICS_ID: process.env.TRENDIT_TEST_DIAGNOSTICS_ID || '',
        DB_HOST: '127.0.0.1', DB_PORT: '1', DB_USER: 'offline', DB_PASSWORD: 'offline',
        DB_NAME: 'offline', YOUTUBE_API_KEY: '', OMP_NUM_THREADS: '4', OPENBLAS_NUM_THREADS: '4', MKL_NUM_THREADS: '4',
      },
      reuseExistingServer: false, timeout: 60000, gracefulShutdown: { signal: 'SIGTERM', timeout: 2000 },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 15173 --strictPort',
      url: 'http://127.0.0.1:15173', env: { VITE_API_URL: 'http://127.0.0.1:18000' },
      reuseExistingServer: false, timeout: 30000, gracefulShutdown: { signal: 'SIGTERM', timeout: 2000 },
    },
  ],
})
