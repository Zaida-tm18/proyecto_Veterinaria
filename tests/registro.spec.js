const { test, expect } = require('@playwright/test');

test.describe('Módulo Registro de usuarios', () => {

  // CP-03: Registro de nuevo usuario dueño de mascota
  test('CP-03: registro exitoso de un nuevo dueño de mascota', async ({ page }) => {
    const correoUnico = `maria.qa.${Date.now()}@example.com`;

    await page.goto('/registro.html');
    await page.getByTestId('registro-nombre-input').fill('María Torres');
    await page.getByTestId('registro-correo-input').fill(correoUnico);
    await page.getByTestId('registro-telefono-input').fill('0991234567');
    await page.getByTestId('registro-password-input').fill('clave123');
    await page.getByTestId('registro-btn').click();

    await expect(page).toHaveURL(/index\.html/);
    await expect(page.locator('.sidebar')).toContainText('María Torres');
  });

  // CP-04: Registro con correo ya existente
  test('CP-04: registro fallido con correo ya existente', async ({ page }) => {
    await page.goto('/registro.html');
    await page.getByTestId('registro-nombre-input').fill('Carlos Duplicado');
    // Correo de prueba ya registrado (ver usuarios de prueba en login.html)
    await page.getByTestId('registro-correo-input').fill('carlos@example.com');
    await page.getByTestId('registro-telefono-input').fill('0987654321');
    await page.getByTestId('registro-password-input').fill('clave123');
    await page.getByTestId('registro-btn').click();

    await expect(page.getByTestId('registro-error')).toBeVisible();
    await expect(page).toHaveURL(/registro\.html/);
  });

});