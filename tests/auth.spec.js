const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Módulo Autenticación (Login)', () => {

  // CP-01: Inicio de sesión exitoso
  test('CP-01: inicio de sesión exitoso con credenciales válidas', async ({ page }) => {
    await login(page, 'admin@veterinariajenny.com', '123456');

    await expect(page).toHaveURL(/index\.html/);
    await expect(page.locator('.sidebar')).toContainText('Administrador');
  });

  // CP-02: Inicio de sesión fallido por contraseña incorrecta
  test('CP-02: inicio de sesión fallido por contraseña incorrecta', async ({ page }) => {
    await page.goto('/login.html');
    await page.getByTestId('login-email-input').fill('admin@veterinariajenny.com');
    await page.getByTestId('login-password-input').fill('claveIncorrecta1');
    await page.getByTestId('login-btn').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/login\.html/);
  });

});