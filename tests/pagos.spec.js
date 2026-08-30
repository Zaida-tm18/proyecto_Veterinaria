const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Módulo Pagos', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@veterinariajenny.com', '123456');
  });

  // CP-08: Registro de un pago (con su forma de pago) actualiza los KPIs financieros
  test('CP-08: registrar un pago pagado por completo actualiza los ingresos totales', async ({ page }) => {
    await page.goto('/pages/pagos.html');

    const ingresosAntesTexto = await page.getByTestId('kpi-ingresos-totales').innerText();
    const ingresosAntes = Number(ingresosAntesTexto.replace(/[^0-9.]/g, ''));
    const transaccionesAntes = Number(await page.getByTestId('kpi-num-transacciones').innerText());

    await page.getByTestId('pagos-new-btn').click();
    await page.waitForURL('**/pago-form.html');

    // La mascota se elige con el autocompletado: se escribe y se hace clic
    // en la primera sugerencia (no hay un <select> con todas listadas).
    await page.locator('#mascotaBuscar').click();
    await page.locator('.ac-item[data-value]').first().click();

    // El producto/servicio se elige de la lista de inventario (no se
    // escribe a mano); su precio unitario se autocompleta solo.
    const productoSelect = page.locator('.it-producto[data-i="0"]');
    const valorConsulta = await productoSelect.locator('option', { hasText: 'Consulta general' }).first().getAttribute('value');
    await productoSelect.selectOption(valorConsulta);

    // Se paga el total completo con una sola forma de pago -> estado "Pagado".
    const total = Number((await page.locator('#totTotal').innerText()).replace(/[^0-9.]/g, ''));
    await page.locator('.mt-metodo[data-i="0"]').selectOption('Efectivo');
    await page.locator('.mt-monto[data-i="0"]').fill(String(total));
    await expect(page.locator('#estadoBadge')).toHaveText('Pagado');

    await page.getByTestId('form-submit-btn').click();
    await page.getByText('Aceptar').click();

    await expect(page).toHaveURL(/pagos\.html/);
    const ingresosDespuesTexto = await page.getByTestId('kpi-ingresos-totales').innerText();
    const ingresosDespues = Number(ingresosDespuesTexto.replace(/[^0-9.]/g, ''));

    expect(ingresosDespues).toBeCloseTo(ingresosAntes + total, 2);
    await expect(page.getByTestId('kpi-num-transacciones')).toHaveText(String(transaccionesAntes + 1));
  });

  // CP-09: Un pago sin ninguna forma de pago registrada queda "No pagado" automáticamente
  test('CP-09: un pago sin forma de pago queda como No pagado (el estado no se elige a mano)', async ({ page }) => {
    await page.goto('/pages/pago-form.html');

    await page.locator('#mascotaBuscar').click();
    await page.locator('.ac-item[data-value]').first().click();

    const productoSelect = page.locator('.it-producto[data-i="0"]');
    const primeraOpcion = await productoSelect.locator('option:not([value=""])').first().getAttribute('value');
    await productoSelect.selectOption(primeraOpcion);

    // No se llena ninguna forma de pago: el badge de estado debe quedar "No pagado" solo.
    await expect(page.locator('#estadoBadge')).toHaveText('No pagado');
  });

});
