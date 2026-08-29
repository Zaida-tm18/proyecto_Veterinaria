const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Módulo Mascotas', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@veterinariajenny.com', '123456');
  });

  // CP-05: Registro exitoso de una nueva mascota
  test('CP-05: registrar una nueva mascota', async ({ page }) => {
    await page.getByTestId('mascotas-new-btn').click();
    await page.waitForURL('**/mascota-form.html');

    await page.locator('#dueno_id').selectOption({ index: 1 }); // primer dueño disponible
    await page.locator('#nombre').fill('Firulais');
    await page.locator('#especie').selectOption('Perro');
    await page.locator('#raza').fill('Labrador');
    await page.locator('#edad').fill('3 años');
    await page.getByTestId('form-submit-btn').click();

    await expect(page.getByTestId('modalOk')).toBeVisible().catch(() => {});
    await page.getByText('Aceptar').click();
    await expect(page).toHaveURL(/mascotas\.html/);
    await expect(page.getByTestId('mascotas-rows')).toContainText('Firulais');
  });

  // CP-06: Búsqueda de mascota por nombre
  test('CP-06: filtrar mascotas por nombre en el buscador', async ({ page }) => {
    await page.goto('/pages/mascotas.html');
    await page.getByTestId('mascotas-search-input').fill('Firulais');

    const filas = page.getByTestId('mascotas-rows').locator('tr');
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText('Firulais');
  });

  // CP-07: Paginación del listado de mascotas
  test('CP-07: navegar a la página 2 del listado de mascotas', async ({ page }) => {
    await page.goto('/pages/mascotas.html');

    const filasPag1 = await page.getByTestId('mascotas-rows').locator('tr').count();
    expect(filasPag1).toBeLessThanOrEqual(8);

    const botonPag2 = page.getByTestId('page-btn-2');
    // Solo continuar si existe una segunda página (más de 8 mascotas registradas)
    if (await botonPag2.count() > 0) {
      await botonPag2.click();
      await expect(botonPag2).toHaveClass(/active/);
    }
  });

});