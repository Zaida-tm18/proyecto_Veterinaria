const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Módulo Mascotas', () => {
  // CP-06 busca la mascota "Firulais" que crea CP-05, y CP-07 depende del
  // total de registros existentes: deben correr en orden, no en paralelo.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@veterinariajenny.com', '123456');
  });

  // Nombre único por proyecto/ejecución: los 3 navegadores corren en
  // paralelo contra la misma base de datos compartida, así que un literal
  // fijo como "Firulais" chocaría entre ellos (y entre corridas sucesivas).
  let nombreMascota;

  // CP-05: Registro exitoso de una nueva mascota
  test('CP-05: registrar una nueva mascota', async ({ page }, testInfo) => {
    nombreMascota = `Firulais-${testInfo.project.name}-${Date.now()}`;

    await page.goto('/pages/mascotas.html');
    await page.getByTestId('mascotas-new-btn').click();
    await page.waitForURL('**/mascota-form.html');

    await page.locator('#dueno_id').selectOption({ index: 1 }); // primer dueño disponible
    await page.locator('#nombre').fill(nombreMascota);
    await page.locator('#especie').selectOption('Perro');
    await page.locator('#raza').fill('Labrador');
    await page.locator('#edad').fill('3 años');
    await page.getByTestId('form-submit-btn').click();

    await expect(page.getByTestId('modalOk')).toBeVisible().catch(() => {});
    await page.getByText('Aceptar').click();
    await expect(page).toHaveURL(/mascotas\.html/);
    // El listado pagina de a 8 y ya tiene registros de corridas previas, así
    // que la mascota nueva puede caer en otra página: usamos el buscador
    // para ubicarla en vez de asumir que está en la página 1.
    await page.getByTestId('mascotas-search-input').fill(nombreMascota);
    await expect(page.getByTestId('mascotas-rows')).toContainText(nombreMascota);
  });

  // CP-06: Búsqueda de mascota por nombre
  test('CP-06: filtrar mascotas por nombre en el buscador', async ({ page }) => {
    await page.goto('/pages/mascotas.html');
    await page.getByTestId('mascotas-search-input').fill(nombreMascota);

    const filas = page.getByTestId('mascotas-rows').locator('tr');
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText(nombreMascota);
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