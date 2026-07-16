require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const mascotasRoutes = require('./routes/mascotas.routes');
const citasRoutes = require('./routes/citas.routes');
const tratamientosRoutes = require('./routes/tratamientos.routes');
const pagosRoutes = require('./routes/pagos.routes');
const inventarioRoutes = require('./routes/inventario.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();

app.use(cors()); // En producción, restringe esto al dominio real del frontend.
app.use(express.json());

// Ruta de salud, útil para verificar que el servidor está vivo.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/mascotas', mascotasRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/tratamientos', tratamientosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/usuarios', usuariosRoutes);

// Manejador de errores genérico (por si algo se escapa de los try/catch)
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API de Veterinaria Jenny's escuchando en http://localhost:${PORT}`);
});
