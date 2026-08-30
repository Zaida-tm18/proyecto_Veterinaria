const { pool } = require('../db');
const { esFechaValida } = require('../utils/fechas');

// Porcentaje de IVA aplicado a todos los comprobantes de venta.
const IVA_PORCENTAJE = 0.15;
const METODOS_VALIDOS = ['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Transferencia'];

// La fecha de un comprobante debe ser una fecha real y no puede ser
// futura (no se puede cobrar algo que todavía no pasó).
function validarFechaPago(fecha) {
  if (!fecha) return null; // se usa CURRENT_DATE por defecto
  if (!esFechaValida(fecha)) return 'La fecha del pago no es válida.';
  const hoyISO = new Date().toISOString().slice(0, 10);
  if (fecha > hoyISO) return 'La fecha del pago no puede ser futura.';
  return null;
}

// Calcula subtotal/iva/total a partir de las líneas de detalle, validando
// que cada una tenga los datos mínimos. Lanza un Error con mensaje legible
// si algo no es válido (lo captura el catch de crear/actualizar).
function calcularTotales(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('El comprobante debe tener al menos un producto o servicio.');
  }
  const detalle = items.map((it) => {
    const concepto = (it.concepto || '').trim();
    const cantidad = Number(it.cantidad);
    const precio_unitario = Number(it.precio_unitario);
    if (!concepto) throw new Error('Cada ítem debe tener una descripción.');
    if (!(cantidad > 0)) throw new Error(`Cantidad inválida para "${concepto}".`);
    if (!(precio_unitario >= 0)) throw new Error(`Precio unitario inválido para "${concepto}".`);
    const subtotal = Math.round(cantidad * precio_unitario * 100) / 100;
    return { concepto, cantidad, precio_unitario, subtotal };
  });
  const subtotal = Math.round(detalle.reduce((acc, it) => acc + it.subtotal, 0) * 100) / 100;
  const iva = Math.round(subtotal * IVA_PORCENTAJE * 100) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;
  return { detalle, subtotal, iva, total };
}

// Valida las formas de pago (puede haber varias, ej. parte en efectivo y
// parte con tarjeta) y calcula, a partir de ellas, cuánto se ha cobrado y
// el estado del comprobante. El estado NUNCA se recibe del cliente: se
// deriva siempre de montoPagado vs. total.
function calcularPago(metodos, total) {
  const detalleMetodos = (Array.isArray(metodos) ? metodos : [])
    .filter((m) => m && m.metodo && Number(m.monto) > 0) // se ignoran filas vacías del formulario
    .map((m) => {
      if (!METODOS_VALIDOS.includes(m.metodo)) throw new Error(`Método de pago inválido: "${m.metodo}".`);
      return { metodo: m.metodo, monto: Math.round(Number(m.monto) * 100) / 100 };
    });

  const montoPagado = Math.round(detalleMetodos.reduce((acc, m) => acc + m.monto, 0) * 100) / 100;
  if (montoPagado > total + 0.01) { // pequeño margen para redondeos
    throw new Error(`Lo pagado (${montoPagado.toFixed(2)}) no puede superar el total del comprobante (${total.toFixed(2)}).`);
  }

  const estado = montoPagado <= 0 ? 'No pagado' : montoPagado >= total - 0.01 ? 'Pagado' : 'Pago parcial';
  return { detalleMetodos, montoPagado, estado };
}

// Reemplaza las líneas de un pago dentro de una transacción ya abierta.
async function guardarItems(client, pagoId, detalle) {
  await client.query('DELETE FROM pago_items WHERE pago_id=$1', [pagoId]);
  for (const it of detalle) {
    await client.query(
      `INSERT INTO pago_items (pago_id, concepto, cantidad, precio_unitario, subtotal)
       VALUES ($1,$2,$3,$4,$5)`,
      [pagoId, it.concepto, it.cantidad, it.precio_unitario, it.subtotal]
    );
  }
}

async function guardarMetodos(client, pagoId, detalleMetodos) {
  await client.query('DELETE FROM pago_metodos WHERE pago_id=$1', [pagoId]);
  for (const m of detalleMetodos) {
    await client.query(
      `INSERT INTO pago_metodos (pago_id, metodo, monto) VALUES ($1,$2,$3)`,
      [pagoId, m.metodo, m.monto]
    );
  }
}

async function adjuntarDetalle(pagos) {
  if (pagos.length === 0) return pagos;
  const ids = pagos.map((p) => p.id);
  const [items, metodos] = await Promise.all([
    pool.query('SELECT * FROM pago_items WHERE pago_id = ANY($1) ORDER BY id', [ids]),
    pool.query('SELECT * FROM pago_metodos WHERE pago_id = ANY($1) ORDER BY id', [ids]),
  ]);
  const itemsPorPago = new Map();
  for (const item of items.rows) {
    if (!itemsPorPago.has(item.pago_id)) itemsPorPago.set(item.pago_id, []);
    itemsPorPago.get(item.pago_id).push(item);
  }
  const metodosPorPago = new Map();
  for (const m of metodos.rows) {
    if (!metodosPorPago.has(m.pago_id)) metodosPorPago.set(m.pago_id, []);
    metodosPorPago.get(m.pago_id).push(m);
  }
  return pagos.map((p) => ({ ...p, items: itemsPorPago.get(p.id) || [], metodos: metodosPorPago.get(p.id) || [] }));
}

// GET /api/pagos
async function listar(req, res) {
  try {
    let sql = `
      SELECT p.*, m.nombre AS mascota, m.dueno_id, u.nombre AS dueno,
             e.nombre AS emitido_por, c.motivo AS cita_motivo, c.fecha AS cita_fecha
      FROM pagos p
      JOIN mascotas m ON m.id = p.mascota_id
      JOIN usuarios u ON u.id = m.dueno_id
      JOIN usuarios e ON e.id = p.creado_por
      LEFT JOIN citas c ON c.id = p.cita_id
      WHERE p.eliminado = false
    `;
    const params = [];
    if (req.user.rol === 'dueno_mascota') {
      params.push(req.user.id);
      sql += ` AND m.dueno_id = $${params.length}`;
    }
    sql += ' ORDER BY p.fecha DESC, p.id DESC';
    const result = await pool.query(sql, params);
    res.json(await adjuntarDetalle(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar pagos.' });
  }
}

// GET /api/pagos/:id  (incluye ítems, formas de pago, dueño y mascota:
// es la información que necesita el comprobante de venta imprimible)
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, m.nombre AS mascota, m.dueno_id,
              u.nombre AS dueno, u.telefono, u.direccion, u.correo,
              e.nombre AS emitido_por,
              c.motivo AS cita_motivo, c.fecha AS cita_fecha, c.hora AS cita_hora
       FROM pagos p
       JOIN mascotas m ON m.id = p.mascota_id
       JOIN usuarios u ON u.id = m.dueno_id
       JOIN usuarios e ON e.id = p.creado_por
       LEFT JOIN citas c ON c.id = p.cita_id
       WHERE p.id=$1 AND p.eliminado=false`,
      [id]
    );
    const pago = result.rows[0];
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado.' });
    if (req.user.rol === 'dueno_mascota' && pago.dueno_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso a este pago.' });
    }
    const [conDetalle] = await adjuntarDetalle([pago]);
    res.json(conDetalle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el pago.' });
  }
}

// POST /api/pagos (solo admin/recepcionista)
// body: { mascota_id, cita_id?, fecha?, items: [{concepto, cantidad, precio_unitario}],
//         metodos: [{metodo, monto}] }
// "creado_por" nunca viene del cliente: siempre es quien está autenticado,
// para que el comprobante quede firmado con la persona real que cobró.
// "estado" tampoco se recibe: se calcula solo a partir de "metodos".
async function crear(req, res) {
  const client = await pool.connect();
  try {
    const { mascota_id, cita_id, fecha, items, metodos } = req.body;
    if (!mascota_id) {
      return res.status(400).json({ error: 'mascota_id es obligatorio.' });
    }
    const errorFecha = validarFechaPago(fecha);
    if (errorFecha) return res.status(400).json({ error: errorFecha });
    const { detalle, subtotal, iva, total } = calcularTotales(items);
    const { detalleMetodos, montoPagado, estado } = calcularPago(metodos, total);

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO pagos (mascota_id, cita_id, creado_por, fecha, estado, subtotal, iva, total, monto_pagado)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6, $7, $8, $9) RETURNING *`,
      [mascota_id, cita_id || null, req.user.id, fecha || null, estado, subtotal, iva, total, montoPagado]
    );
    const pago = result.rows[0];
    await guardarItems(client, pago.id, detalle);
    await guardarMetodos(client, pago.id, detalleMetodos);
    await client.query('COMMIT');

    res.status(201).json({ ...pago, items: detalle, metodos: detalleMetodos });
  } catch (err) {
    await client.query('ROLLBACK');
    const esErrorDeValidacion = err.message && !err.code; // errores lanzados por calcularTotales/calcularPago, no de pg
    console.error(err);
    res.status(esErrorDeValidacion ? 400 : 500).json({ error: esErrorDeValidacion ? err.message : 'Error al crear el pago.' });
  } finally {
    client.release();
  }
}

// PUT /api/pagos/:id (solo admin/recepcionista)
async function actualizar(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { fecha, cita_id, items, metodos } = req.body;
    const errorFecha = validarFechaPago(fecha);
    if (errorFecha) return res.status(400).json({ error: errorFecha });
    const { detalle, subtotal, iva, total } = calcularTotales(items);
    const { detalleMetodos, montoPagado, estado } = calcularPago(metodos, total);

    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE pagos SET fecha=$1, cita_id=$2, estado=$3, subtotal=$4, iva=$5, total=$6, monto_pagado=$7, actualizado_en=now()
       WHERE id=$8 AND eliminado=false RETURNING *`,
      [fecha, cita_id || null, estado, subtotal, iva, total, montoPagado, id]
    );
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pago no encontrado.' });
    }
    await guardarItems(client, id, detalle);
    await guardarMetodos(client, id, detalleMetodos);
    await client.query('COMMIT');

    res.json({ ...result.rows[0], items: detalle, metodos: detalleMetodos });
  } catch (err) {
    await client.query('ROLLBACK');
    const esErrorDeValidacion = err.message && !err.code;
    console.error(err);
    res.status(esErrorDeValidacion ? 400 : 500).json({ error: esErrorDeValidacion ? err.message : 'Error al actualizar el pago.' });
  } finally {
    client.release();
  }
}

// DELETE /api/pagos/:id (solo admin)
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE pagos SET eliminado=true WHERE id=$1 AND eliminado=false RETURNING id',
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pago no encontrado.' });
    res.json({ mensaje: 'Pago movido a la papelera.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el pago.' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
