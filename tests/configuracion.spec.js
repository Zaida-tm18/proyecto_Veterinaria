const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Módulo Configuración de la Clínica', () => {

  // CP-10: Restricción de acceso al módulo de Configuración
  test('CP-10: un usuario no-admin no puede acceder a Configuración', async ({ page }) => {
    await login(page, 'jenny@veterinariajenny.com', '123456'); // rol veterinario

    await expect(page.getByTestId('nav-configuracion')).toHaveCount(0);

    await page.goto('/pages/configuracion.html');
    await expect(page).toHaveURL(/index\.html/);
  });

});