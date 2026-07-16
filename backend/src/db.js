// Conexión centralizada a PostgreSQL usando el driver 'pg'.
// Todo el resto del backend importa "pool" desde aquí en vez de
// crear sus propias conexiones.
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

pool.on('error', (err) => {
  // Errores de conexiones inactivas del pool (no de una query puntual)
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

// Pequeño helper para loggear queries en desarrollo. Úsalo en vez de
// pool.query directamente si quieres ver qué se está ejecutando.
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('SQL ejecutado', { text, duration, rows: res.rowCount });
  }
  return res;
}

module.exports = { pool, query };
