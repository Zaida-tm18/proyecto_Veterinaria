const { pool } = require('../db');

// GET /api/tratamientos
async function listar(req, res) {
  try {
    let sql = `
      SELECT t.*, m.nombre AS mascota, m.dueno_id, u.nombre AS dueno
      FROM tratamientos t
      JOIN mascotas m ON m.id = t.mascota_id
      JOIN usuarios u ON u.id = m.dueno_id
      WHERE t.eliminado = false
    `;
    const params = [];
    if (req.user.rol === 'dueno_mascota') {
      params.push(req.user.id);
      sql += ` AND m.dueno_id = $${params.length}`;
    }
    sql += ' ORDER BY t.id DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar tratamientos.' });
  }
}

// GET /api/tratamientos/:id
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT t.*, m.nombre AS mascota, m.dueno_id
       FROM tratamientos t JOIN mascotas m ON m.id = t.mascota_id
       WHERE t.id=$1 AND t.eliminado=false`,
      [id]
    );
    const tratamiento = result.rows[0];
    if (!tratamiento) return res.status(404).json({ error: 'Tratamiento no encontrado.' });
    if (req.user.rol === 'dueno_mascota' && tratamiento.dueno_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso a este tratamiento.' });
    }
    res.json(tratamiento);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el tratamiento.' });
  }
}

// POST /api/tratamientos  (solo admin/veterinario, validado en la ruta)
async function crear(req, res) {
  try {
    const { mascota_id, diagnostico, tratamiento, medicamento, dosis, frecuencia, inicio, fin, estado } = req.body;
    if (!mascota_id || !diagnostico) {
      return res.status(400).json({ error: 'mascota_id y diagnostico son obligatorios.' });
    }
    const result = await pool.query(
      `INSERT INTO tratamientos (mascota_id, diagnostico, tratamiento, medicamento, dosis, frecuencia, inicio, fin, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'Activo')) RETURNING *`,
      [mascota_id, diagnostico, tratamiento || null, medicamento || null, dosis || null, frecuencia || null, inicio || null, fin || null, estado || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el tratamiento.' });
  }
}

// PUT /api/tratamientos/:id (solo admin/veterinario)
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { diagnostico, tratamiento, medicamento, dosis, frecuencia, inicio, fin, estado } = req.body;
    const result = await pool.query(
      `UPDATE tratamientos SET diagnostico=$1, tratamiento=$2, medicamento=$3, dosis=$4,
       frecuencia=$5, inicio=$6, fin=$7, estado=$8
       WHERE id=$9 AND eliminado=false RETURNING *`,
      [diagnostico, tratamiento, medicamento, dosis, frecuencia, inicio || null, fin || null, estado, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Tratamiento no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el tratamiento.' });
  }
}

// DELETE /api/tratamientos/:id (solo admin/veterinario)
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE tratamientos SET eliminado=true WHERE id=$1 AND eliminado=false RETURNING id',
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Tratamiento no encontrado.' });
    res.json({ mensaje: 'Tratamiento movido a la papelera.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el tratamiento.' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
