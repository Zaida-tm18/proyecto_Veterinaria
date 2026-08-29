const { pool } = require('../db');

// GET /api/configuracion
// Pública (sin auth): la necesitan también login.html y registro.html
// para mostrar el nombre y el logo de la clínica antes de iniciar sesión.
async function obtener(req, res) {
  try {
    const result = await pool.query(
      'SELECT nombre_clinica, logo_data, direccion, telefono, correo_contacto, actualizado_en FROM configuracion WHERE id = 1'
    );
    if (!result.rows[0]) {
      return res.json({ nombre_clinica: "Veterinaria Jenny's", logo_data: null, direccion: null, telefono: null, correo_contacto: null });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener la configuración de la clínica.' });
  }
}

// PUT /api/configuracion  (solo admin, validado en la ruta)
// logo_data se espera como data URL base64 (o null para quitar el logo).
async function actualizar(req, res) {
  try {
    const { nombre_clinica, logo_data, direccion, telefono, correo_contacto } = req.body;

    if (!nombre_clinica || !nombre_clinica.trim()) {
      return res.status(400).json({ error: 'El nombre de la clínica es obligatorio.' });
    }
    if (nombre_clinica.length > 150) {
      return res.status(400).json({ error: 'El nombre de la clínica es demasiado largo.' });
    }
    // Límite razonable para el logo en base64 (~4MB de imagen original).
    if (logo_data && logo_data.length > 6_000_000) {
      return res.status(400).json({ error: 'La imagen del logo es demasiado grande. Usa una imagen más liviana (máx. ~4MB).' });
    }

    const result = await pool.query(
      `INSERT INTO configuracion (id, nombre_clinica, logo_data, direccion, telefono, correo_contacto, actualizado_en)
       VALUES (1, $1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET
         nombre_clinica = EXCLUDED.nombre_clinica,
         logo_data = EXCLUDED.logo_data,
         direccion = EXCLUDED.direccion,
         telefono = EXCLUDED.telefono,
         correo_contacto = EXCLUDED.correo_contacto,
         actualizado_en = now()
       RETURNING nombre_clinica, logo_data, direccion, telefono, correo_contacto, actualizado_en`,
      [nombre_clinica.trim(), logo_data || null, direccion || null, telefono || null, correo_contacto || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la configuración de la clínica.' });
  }
}

module.exports = { obtener, actualizar };
