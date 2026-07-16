const { pool } = require('../db');

// Helper: si el usuario es dueño de mascota, solo puede ver lo suyo.
// Los demás roles (admin, veterinario, recepcionista) ven todo.
function filtroDuenoSQL(req) {
  if (req.user.rol === 'dueno_mascota') {
    return { clausula: 'AND m.dueno_id = $paramIndex', valor: req.user.id };
  }
  return { clausula: '', valor: null };
}

// GET /api/mascotas
async function listar(req, res) {
  try {
    const filtro = filtroDuenoSQL(req);
    const params = [];
    let sql = `
      SELECT m.id, m.nombre, m.especie, m.raza, m.edad, m.dueno_id,
             u.nombre AS dueno, u.telefono
      FROM mascotas m
      JOIN usuarios u ON u.id = m.dueno_id
      WHERE m.eliminado = false
    `;
    if (filtro.valor !== null) {
      params.push(filtro.valor);
      sql += ` AND m.dueno_id = $${params.length}`;
    }
    sql += ' ORDER BY m.id';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar mascotas.' });
  }
}

// GET /api/mascotas/:id
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT m.id, m.nombre, m.especie, m.raza, m.edad, m.dueno_id,
              u.nombre AS dueno, u.telefono, u.correo
       FROM mascotas m
       JOIN usuarios u ON u.id = m.dueno_id
       WHERE m.id = $1 AND m.eliminado = false`,
      [id]
    );
    const mascota = result.rows[0];
    if (!mascota) return res.status(404).json({ error: 'Mascota no encontrada.' });

    if (req.user.rol === 'dueno_mascota' && mascota.dueno_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso a esta mascota.' });
    }

    res.json(mascota);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener la mascota.' });
  }
}

// POST /api/mascotas
// admin, veterinario, recepcionista pueden registrar para cualquier dueño.
// dueno_mascota solo puede registrar mascotas para sí mismo.
async function crear(req, res) {
  try {
    const { nombre, especie, raza, edad, dueno_id } = req.body;
    if (!nombre || !especie) {
      return res.status(400).json({ error: 'Nombre y especie son obligatorios.' });
    }

    let duenoFinal = dueno_id;
    if (req.user.rol === 'dueno_mascota') {
      duenoFinal = req.user.id;
    }
    if (!duenoFinal) {
      return res.status(400).json({ error: 'Debe indicarse el dueño de la mascota.' });
    }

    const result = await pool.query(
      `INSERT INTO mascotas (nombre, especie, raza, edad, dueno_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, especie, raza || null, edad || null, duenoFinal]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la mascota.' });
  }
}

// PUT /api/mascotas/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, especie, raza, edad } = req.body;

    const actual = await pool.query('SELECT * FROM mascotas WHERE id=$1 AND eliminado=false', [id]);
    if (!actual.rows[0]) return res.status(404).json({ error: 'Mascota no encontrada.' });

    if (req.user.rol === 'dueno_mascota' && actual.rows[0].dueno_id !== req.user.id) {
      return res.status(403).json({ error: 'No puedes editar mascotas de otro dueño.' });
    }

    const result = await pool.query(
      `UPDATE mascotas SET nombre=$1, especie=$2, raza=$3, edad=$4
       WHERE id=$5 RETURNING *`,
      [nombre, especie, raza || null, edad || null, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la mascota.' });
  }
}

// DELETE /api/mascotas/:id  (borrado lógico -> "papelera")
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const actual = await pool.query('SELECT * FROM mascotas WHERE id=$1 AND eliminado=false', [id]);
    if (!actual.rows[0]) return res.status(404).json({ error: 'Mascota no encontrada.' });

    if (req.user.rol === 'dueno_mascota' && actual.rows[0].dueno_id !== req.user.id) {
      return res.status(403).json({ error: 'No puedes eliminar mascotas de otro dueño.' });
    }

    await pool.query('UPDATE mascotas SET eliminado = true WHERE id=$1', [id]);
    res.json({ mensaje: 'Mascota movida a la papelera.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la mascota.' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
