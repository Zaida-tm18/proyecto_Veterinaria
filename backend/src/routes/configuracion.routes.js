const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/configuracion.controller');

const router = express.Router();

// Pública: login.html y registro.html la necesitan sin sesión iniciada.
router.get('/', ctrl.obtener);

// Solo el admin puede modificar los datos generales de la clínica.
router.put('/', requireAuth, requireRole('admin'), ctrl.actualizar);

module.exports = router;
