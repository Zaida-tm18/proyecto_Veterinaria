const { pool } = require('../db');
const { esFechaValida } = require('../utils/fechas');

// Valida (si vienen) que inicio/fin sean fechas reales y que fin no sea
// anterior a inicio. Devuelve un mensaje de error o null si todo bien.
function validarRangoFechas(inicio, fin) {
  if (inicio && !esFechaValida(inicio)) return 'La fecha de inicio del tratamiento no es válida.';
  if (fin && !esFechaValida(fin)) return 'La fecha de fin del tratamiento no es válida.';
  if (inicio && fin && fin < inicio) return 'La fecha de fin no puede ser anterior a la fecha de inicio.';
  return null;
}

// GET /api/tratamientos
async function listar(req, res) {
  try {
    let sql = `
      SELECT t.*, m.nombre AS mascota, m.dueno_id, u.nombre AS dueno,
             c.fecha AS cita_fecha, c.hora AS cita_hora, c.motivo AS cita_motivo
      FROM tratamientos t
      JOIN mascotas m ON m.id = t.mascota_id
      JOIN usuarios u ON u.id = m.dueno_id
      JOIN citas c ON c.id = t.cita_id
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
      `SELECT t.*, m.nombre AS mascota, m.dueno_id,
              c.fecha AS cita_fecha, c.hora AS cita_hora, c.motivo AS cita_motivo
       FROM tratamientos t
       JOIN mascotas m ON m.id = t.mascota_id
       JOIN citas c ON c.id = t.cita_id
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
// Todo tratamiento nace de una cita puntual: cita_id es obligatorio y
// mascota_id se deriva de esa cita (así no puede quedar inconsistente).
async function crear(req, res) {
  try {
    const { cita_id, diagnostico, tratamiento, medicamento, dosis, frecuencia, insumos, inicio, fin, estado } = req.body;
    if (!cita_id || !diagnostico) {
      return res.status(400).json({ error: 'cita_id y diagnostico son obligatorios.' });
    }
    const errorFechas = validarRangoFechas(inicio, fin);
    if (errorFechas) return res.status(400).json({ error: errorFechas });

    const cita = await pool.query('SELECT mascota_id FROM citas WHERE id=$1 AND eliminado=false', [cita_id]);
    if (!cita.rows[0]) return res.status(400).json({ error: 'La cita indicada no existe.' });

    const result = await pool.query(
      `INSERT INTO tratamientos (cita_id, mascota_id, diagnostico, tratamiento, medicamento, dosis, frecuencia, insumos, inicio, fin, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,'Activo')) RETURNING *`,
      [cita_id, cita.rows[0].mascota_id, diagnostico, tratamiento || null, medicamento || null, dosis || null, frecuencia || null, insumos || null, inicio || null, fin || null, estado || null]
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
    const { diagnostico, tratamiento, medicamento, dosis, frecuencia, insumos, inicio, fin, estado } = req.body;
    const errorFechas = validarRangoFechas(inicio, fin);
    if (errorFechas) return res.status(400).json({ error: errorFechas });

    const result = await pool.query(
      `UPDATE tratamientos SET diagnostico=$1, tratamiento=$2, medicamento=$3, dosis=$4,
       frecuencia=$5, insumos=$6, inicio=$7, fin=$8, estado=$9, actualizado_en=now()
       WHERE id=$10 AND eliminado=false RETURNING *`,
      [diagnostico, tratamiento, medicamento, dosis, frecuencia, insumos || null, inicio || null, fin || null, estado, id]
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
