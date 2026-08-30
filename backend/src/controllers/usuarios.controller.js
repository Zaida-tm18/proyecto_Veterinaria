const { pool } = require('../db');
const bcrypt = require('bcryptjs');

// GET /api/usuarios?rol=dueno_mascota&todos=1
// Lista básica de usuarios, usada para poblar selects en el frontend
// (por ejemplo, elegir el dueño al registrar una mascota, o el
// veterinario al agendar una cita). No expone password_hash.
// "todos=1" incluye usuarios inactivos; solo tiene sentido para el
// panel de administración de usuarios (el admin ya pasó requireRole).
async function listar(req, res) {
  try {
    const { rol, todos } = req.query;
    const params = [];
    let sql = 'SELECT id, nombre, correo, rol, telefono, direccion, activo, creado_en, actualizado_en FROM usuarios WHERE 1=1';
    if (!(todos && req.user.rol === 'admin')) sql += ' AND activo = true';
    if (rol) {
      params.push(rol);
      sql += ` AND rol = $${params.length}`;
    }
    sql += ' ORDER BY nombre';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar usuarios.' });
  }
}

const ROLES_VALIDOS = ['admin', 'veterinario', 'recepcionista', 'dueno_mascota'];

// POST /api/usuarios  (solo admin, validado en la ruta)
async function crear(req, res) {
  try {
    const { nombre, correo, password, rol, telefono, direccion } = req.body;
    if (!nombre || !correo || !password || !rol) {
      return res.status(400).json({ error: 'Nombre, correo, contraseña y rol son obligatorios.' });
    }
    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const existente = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
    if (existente.rows[0]) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, telefono, direccion)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nombre, correo, rol, telefono, direccion, activo`,
      [nombre, correo, hash, rol, telefono || null, direccion || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el usuario.' });
  }
}

// PUT /api/usuarios/:id  (solo admin, validado en la ruta)
// La contraseña es opcional: si no se envía, se deja la actual sin tocar.
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, correo, password, rol, telefono, direccion, activo } = req.body;

    if (rol && !ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }

    const actual = await pool.query('SELECT * FROM usuarios WHERE id=$1', [id]);
    if (!actual.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Evita que el admin se desactive o se quite el rol de admin a sí mismo
    // por error y se quede sin poder volver a entrar al panel.
    if (Number(id) === req.user.id && (activo === false || activo === 'false' || (rol && rol !== 'admin'))) {
      return res.status(400).json({ error: 'No puedes desactivarte ni cambiar tu propio rol de administrador.' });
    }

    let passwordHash = actual.rows[0].password_hash;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      `UPDATE usuarios SET nombre=$1, correo=$2, password_hash=$3, rol=$4, telefono=$5, direccion=$6, activo=$7, actualizado_en=now()
       WHERE id=$8 RETURNING id, nombre, correo, rol, telefono, direccion, activo, actualizado_en`,
      [
        nombre ?? actual.rows[0].nombre,
        correo ?? actual.rows[0].correo,
        passwordHash,
        rol ?? actual.rows[0].rol,
        telefono ?? actual.rows[0].telefono,
        direccion ?? actual.rows[0].direccion,
        activo === undefined ? actual.rows[0].activo : (activo === true || activo === 'true'),
        id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el usuario.' });
  }
}

// GET /api/usuarios/:id  (solo admin, validado en la ruta)
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, nombre, correo, rol, telefono, direccion, activo FROM usuarios WHERE id=$1', [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el usuario.' });
  }
}

module.exports = { listar, obtener, crear, actualizar };
