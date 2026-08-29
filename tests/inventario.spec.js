const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Módulo Inventario', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@veterinariajenny.com', '123456');
    await page.goto('/pages/inventario.html');
  });

  // CP-09: Filtro de inventario por stock bajo
  test('CP-09: el checkbox "Solo stock bajo" filtra solo productos críticos', async ({ page }) => {
    await page.getByTestId('inventario-lowstock-checkbox').check();

    const filas = page.getByTestId('inventario-rows').locator('tr');
    const total = await filas.count();

    for (let i = 0; i < total; i++) {
      await expect(filas.nth(i)).toContainText('Crítico');
    }
  });

});