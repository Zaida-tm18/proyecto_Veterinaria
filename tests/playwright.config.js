// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Captura una screenshot al final de cada test, pase o falle. */
    screenshot: 'on',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Levanta backend y frontend antes de correr las pruebas. Sin el
     backend, login/registro nunca responden y los tests fallan. */
  webServer: [
    {
      // La API vive en ../backend y necesita PostgreSQL ya configurado
      // (ver README.md) antes de que este comando funcione.
      command: 'npm start',
      cwd: '../backend',
      // La raíz "/" no tiene ruta y responde 404, lo que Playwright
      // interpreta como "servidor no listo" y no lo reutiliza aunque
      // ya esté corriendo. "/api/health" sí responde 200 siempre.
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
    },
    {
      // El frontend vive en ../frontend, no en tests/, por eso hay que
      // indicarle a Playwright dónde ejecutar el comando (cwd).
      command: 'npx serve . -l 3000',
      cwd: '../frontend',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
    },
  ],
});