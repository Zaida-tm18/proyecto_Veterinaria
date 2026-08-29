const { expect } = require('@playwright/test');

async function login(page, correo, password) {
  await page.goto('/login.html');
  await page.getByTestId('login-email-input').fill(correo);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('login-btn').click();
  await page.waitForURL('**/index.html');
}

module.exports = { login, expect };