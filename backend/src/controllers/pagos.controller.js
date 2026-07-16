const { pool } = require('../db');

// GET /api/pagos
async function listar(req, res) {
  try {
    let sql = `
      SELECT p.*, m.nombre AS mascota, m.dueno_id, u.nombre AS dueno
      FROM pagos p
      JOIN mascotas m ON m.id = p.mascota_id
      JOIN usuarios u ON u.id = m.dueno_id
      WHERE p.eliminado = false
    `;
    const params = [];
    if (req.user.rol === 'dueno_mascota') {
      params.push(req.user.id);
      sql += ` AND m.dueno_id = $${params.length}`;
    }
    sql += ' ORDER BY p.fecha DESC, p.id DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar pagos.' });
  }
}

// GET /api/pagos/:id
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, m.nombre AS mascota, m.dueno_id
       FROM pagos p JOIN mascotas m ON m.id = p.mascota_id
       WHERE p.id=$1 AND p.eliminado=false`,
      [id]
    );
    const pago = result.rows[0];
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado.' });
    if (req.user.rol === 'dueno_mascota' && pago.dueno_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso a este pago.' });
    }
    res.json(pago);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el pago.' });
  }
}

// POST /api/pagos (solo admin/recepcionista)
async function crear(req, res) {
  try {
    const { mascota_id, fecha, concepto, monto, metodo, estado } = req.body;
    if (!mascota_id || !concepto || !monto || !metodo) {
      return res.status(400).json({ error: 'mascota_id, concepto, monto y metodo son obligatorios.' });
    }
    if (Number(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    }
    const result = await pool.query(
      `INSERT INTO pagos (mascota_id, fecha, concepto, monto, metodo, estado)
       VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, COALESCE($6,'Pendiente')) RETURNING *`,
      [mascota_id, fecha || null, concepto, monto, metodo, estado || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el pago.' });
  }
}

// PUT /api/pagos/:id (solo admin/recepcionista)
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { fecha, concepto, monto, metodo, estado } = req.body;
    if (monto !== undefined && Number(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    }
    const result = await pool.query(
      `UPDATE pagos SET fecha=$1, concepto=$2, monto=$3, metodo=$4, estado=$5
       WHERE id=$6 AND eliminado=false RETURNING *`,
      [fecha, concepto, monto, metodo, estado, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pago no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el pago.' });
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
