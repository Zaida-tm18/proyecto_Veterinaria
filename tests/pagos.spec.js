const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Módulo Pagos', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@veterinariajenny.com', '123456');
  });

  // CP-08: Registro de un pago y actualización de KPIs financieros
  test('CP-08: registrar un pago actualiza los ingresos totales', async ({ page }) => {
    await page.goto('/pages/pagos.html');

    const ingresosAntesTexto = await page.getByTestId('kpi-ingresos-totales').innerText();
    const ingresosAntes = Number(ingresosAntesTexto.replace(/[^0-9.]/g, ''));
    const transaccionesAntes = Number(await page.getByTestId('kpi-num-transacciones').innerText());

    await page.getByTestId('pagos-new-btn').click();
    await page.waitForURL('**/pago-form.html');

    await page.locator('#mascota_id').selectOption({ index: 1 });
    await page.locator('#concepto').fill('Consulta general');
    await page.locator('#monto').fill('25');
    await page.locator('#metodo').selectOption('Efectivo');
    await page.locator('#estado').selectOption('Pagado');
    await page.getByTestId('form-submit-btn').click();
    await page.getByText('Aceptar').click();

    await expect(page).toHaveURL(/pagos\.html/);
    const ingresosDespuesTexto = await page.getByTestId('kpi-ingresos-totales').innerText();
    const ingresosDespues = Number(ingresosDespuesTexto.replace(/[^0-9.]/g, ''));

    expect(ingresosDespues).toBeCloseTo(ingresosAntes + 25, 2);
    await expect(page.getByTestId('kpi-num-transacciones')).toHaveText(String(transaccionesAntes + 1));
  });

});