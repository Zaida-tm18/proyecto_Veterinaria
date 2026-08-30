const { pool } = require('../db');
const { esFechaValida, esHoraValida, combinarFechaHora } = require('../utils/fechas');

// GET /api/citas
async function listar(req, res) {
  try {
    let sql = `
      SELECT c.id, c.fecha, c.hora, c.motivo, c.estado, c.veterinario_id, c.actualizado_en,
             m.id AS mascota_id, m.nombre AS mascota, m.dueno_id,
             u.nombre AS dueno,
             v.nombre AS veterinario
      FROM citas c
      JOIN mascotas m ON m.id = c.mascota_id
      JOIN usuarios u ON u.id = m.dueno_id
      LEFT JOIN usuarios v ON v.id = c.veterinario_id
      WHERE c.eliminado = false
    `;
    const params = [];
    if (req.user.rol === 'dueno_mascota') {
      params.push(req.user.id);
      sql += ` AND m.dueno_id = $${params.length}`;
    }
    sql += ' ORDER BY c.fecha, c.hora';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar citas.' });
  }
}

// GET /api/citas/:id
// Incluye los tratamientos y pagos que salieron de esta cita: es la
// "ficha de auditoría" de la visita (qué se diagnosticó, qué se cobró
// y quién lo hizo).
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, m.nombre AS mascota, m.dueno_id, u.nombre AS dueno, v.nombre AS veterinario
       FROM citas c
       JOIN mascotas m ON m.id = c.mascota_id
       JOIN usuarios u ON u.id = m.dueno_id
       LEFT JOIN usuarios v ON v.id = c.veterinario_id
       WHERE c.id = $1 AND c.eliminado = false`,
      [id]
    );
    const cita = result.rows[0];
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada.' });
    if (req.user.rol === 'dueno_mascota' && cita.dueno_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso a esta cita.' });
    }

    const [tratamientos, pagos] = await Promise.all([
      pool.query('SELECT * FROM tratamientos WHERE cita_id=$1 AND eliminado=false ORDER BY id', [id]),
      pool.query(
        `SELECT p.*, e.nombre AS emitido_por FROM pagos p
         JOIN usuarios e ON e.id = p.creado_por
         WHERE p.cita_id=$1 AND p.eliminado=false ORDER BY p.id`,
        [id]
      ),
    ]);

    res.json({ ...cita, tratamientos: tratamientos.rows, pagos: pagos.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener la cita.' });
  }
}

// Verifica que la mascota indicada le pertenezca al dueño autenticado
// (solo aplica cuando el rol es dueno_mascota).
async function verificarPropiedadMascota(req, mascotaId) {
  if (req.user.rol !== 'dueno_mascota') return true;
  const r = await pool.query('SELECT dueno_id FROM mascotas WHERE id=$1', [mascotaId]);
  return r.rows[0] && r.rows[0].dueno_id === req.user.id;
}

// POST /api/citas
async function crear(req, res) {
  try {
    const { mascota_id, fecha, hora, motivo, veterinario_id, estado } = req.body;
    if (!mascota_id || !fecha || !hora || !motivo) {
      return res.status(400).json({ error: 'mascota_id, fecha, hora y motivo son obligatorios.' });
    }
    if (!esFechaValida(fecha)) return res.status(400).json({ error: 'La fecha de la cita no es válida.' });
    if (!esHoraValida(hora)) return res.status(400).json({ error: 'La hora de la cita no es válida (usa el formato HH:MM).' });
    const momentoCita = combinarFechaHora(fecha, hora);
    if (momentoCita < new Date()) {
      return res.status(400).json({ error: 'No puedes agendar una cita en una fecha y hora que ya pasaron.' });
    }

    const puede = await verificarPropiedadMascota(req, mascota_id);
    if (!puede) return res.status(403).json({ error: 'No puedes agendar citas para mascotas de otro dueño.' });

    // Solo el staff puede fijar el estado inicial como 'Confirmada' o asignar veterinario;
    // un dueño que agenda queda automáticamente en 'Pendiente'.
    const esStaff = ['admin', 'veterinario', 'recepcionista'].includes(req.user.rol);
    const estadoFinal = esStaff ? (estado || 'Pendiente') : 'Pendiente';
    const veterinarioFinal = esStaff ? (veterinario_id || null) : null;

    const result = await pool.query(
      `INSERT INTO citas (mascota_id, fecha, hora, motivo, veterinario_id, estado)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [mascota_id, fecha, hora, motivo, veterinarioFinal, estadoFinal]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la cita.' });
  }
}

// PUT /api/citas/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { fecha, hora, motivo, veterinario_id, estado } = req.body;
    if (!esFechaValida(fecha)) return res.status(400).json({ error: 'La fecha de la cita no es válida.' });
    if (!esHoraValida(hora)) return res.status(400).json({ error: 'La hora de la cita no es válida (usa el formato HH:MM).' });

    const actual = await pool.query(
      `SELECT c.*, m.dueno_id FROM citas c JOIN mascotas m ON m.id=c.mascota_id
       WHERE c.id=$1 AND c.eliminado=false`, [id]
    );
    if (!actual.rows[0]) return res.status(404).json({ error: 'Cita no encontrada.' });

    const esStaff = ['admin', 'veterinario', 'recepcionista'].includes(req.user.rol);
    if (req.user.rol === 'dueno_mascota' && actual.rows[0].dueno_id !== req.user.id) {
      return res.status(403).json({ error: 'No puedes editar citas de otro dueño.' });
    }

    // Un dueño puede reprogramar fecha/hora/motivo, pero no cambiar estado ni veterinario.
    // Si de verdad está reprogramando (cambia fecha u hora), la nueva fecha/hora
    // tampoco puede quedar en el pasado; si solo edita otros campos de una cita
    // que ya pasó (ej. anotar el motivo real), no se le exige nada sobre la fecha.
    const fechaActualISO = new Date(actual.rows[0].fecha).toISOString().slice(0, 10);
    const cambiaFechaHora = fecha !== fechaActualISO || hora !== String(actual.rows[0].hora).slice(0, 5);
    if (cambiaFechaHora && combinarFechaHora(fecha, hora) < new Date()) {
      return res.status(400).json({ error: 'No puedes reprogramar la cita a una fecha y hora que ya pasaron.' });
    }

    const nuevoEstado = esStaff ? (estado || actual.rows[0].estado) : actual.rows[0].estado;
    const nuevoVet = esStaff ? (veterinario_id ?? actual.rows[0].veterinario_id) : actual.rows[0].veterinario_id;

    const result = await pool.query(
      `UPDATE citas SET fecha=$1, hora=$2, motivo=$3, veterinario_id=$4, estado=$5, actualizado_en=now()
       WHERE id=$6 RETURNING *`,
      [fecha, hora, motivo, nuevoVet, nuevoEstado, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la cita.' });
  }
}

// DELETE /api/citas/:id
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const actual = await pool.query(
      `SELECT c.*, m.dueno_id FROM citas c JOIN mascotas m ON m.id=c.mascota_id
       WHERE c.id=$1 AND c.eliminado=false`, [id]
    );
    if (!actual.rows[0]) return res.status(404).json({ error: 'Cita no encontrada.' });
    if (req.user.rol === 'dueno_mascota' && actual.rows[0].dueno_id !== req.user.id) {
      return res.status(403).json({ error: 'No puedes eliminar citas de otro dueño.' });
    }
    await pool.query('UPDATE citas SET eliminado=true WHERE id=$1', [id]);
    res.json({ mensaje: 'Cita movida a la papelera.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la cita.' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
