const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
// Body: { correo, password }
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, nombre, correo, password_hash, rol, activo FROM usuarios WHERE correo = $1',
      [correo]
    );

    const usuario = result.rows[0];
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({ token, usuario: payload });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno al iniciar sesión.' });
  }
});

// GET /api/auth/me  -> devuelve los datos del usuario autenticado
// Útil para que el frontend valide la sesión al cargar cualquier página.
router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.user });
});

// POST /api/auth/registro
// Registro público, exclusivo para dueños de mascota. El rol SIEMPRE se fuerza
// a 'dueno_mascota' en el servidor: nunca se confía en un rol enviado desde
// el cliente en un endpoint público (evita que alguien se autoregistre como admin).
router.post('/registro', async (req, res) => {
  const { nombre, correo, password, telefono } = req.body;

  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const existente = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
    if (existente.rows[0]) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, telefono)
       VALUES ($1, $2, $3, 'dueno_mascota', $4)
       RETURNING id, nombre, correo, rol, telefono`,
      [nombre, correo, hash, telefono || null]
    );

    const usuario = result.rows[0];
    const token = jwt.sign(usuario, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
    res.status(201).json({ token, usuario });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno al registrar la cuenta.' });
  }
});

module.exports = router;
