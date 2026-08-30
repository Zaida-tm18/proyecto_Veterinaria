const { pool } = require('../db');
const { esFechaValida } = require('../utils/fechas');

// GET /api/inventario
async function listar(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM inventario WHERE eliminado = false ORDER BY producto'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar inventario.' });
  }
}

// GET /api/inventario/:id
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM inventario WHERE id=$1 AND eliminado=false', [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el producto.' });
  }
}

// POST /api/inventario
async function crear(req, res) {
  try {
    const { producto, categoria, cantidad, unidad, minimo, precio, vencimiento } = req.body;
    if (!producto || !categoria || !unidad) {
      return res.status(400).json({ error: 'producto, categoria y unidad son obligatorios.' });
    }
    if (vencimiento && !esFechaValida(vencimiento)) {
      return res.status(400).json({ error: 'La fecha de vencimiento no es válida.' });
    }
    const result = await pool.query(
      `INSERT INTO inventario (producto, categoria, cantidad, unidad, minimo, precio, vencimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [producto, categoria, cantidad || 0, unidad, minimo || 0, precio || 0, vencimiento || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el producto.' });
  }
}

// PUT /api/inventario/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { producto, categoria, cantidad, unidad, minimo, precio, vencimiento } = req.body;
    if (vencimiento && !esFechaValida(vencimiento)) {
      return res.status(400).json({ error: 'La fecha de vencimiento no es válida.' });
    }
    const result = await pool.query(
      `UPDATE inventario SET producto=$1, categoria=$2, cantidad=$3, unidad=$4,
       minimo=$5, precio=$6, vencimiento=$7, actualizado_en=now()
       WHERE id=$8 AND eliminado=false RETURNING *`,
      [producto, categoria, cantidad, unidad, minimo, precio, vencimiento || null, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el producto.' });
  }
}

// DELETE /api/inventario/:id
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE inventario SET eliminado=true WHERE id=$1 AND eliminado=false RETURNING id',
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ mensaje: 'Producto movido a la papelera.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el producto.' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
