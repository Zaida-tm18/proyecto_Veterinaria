const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/pagos.controller');

const router = express.Router();
router.use(requireAuth);

// Lectura: todos los roles (filtrado por dueño dentro del controlador).
router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);

// Escritura: solo personal administrativo, no el dueño ni el veterinario.
router.post('/', requireRole('admin', 'recepcionista'), ctrl.crear);
router.put('/:id', requireRole('admin', 'recepcionista'), ctrl.actualizar);
router.delete('/:id', requireRole('admin'), ctrl.eliminar);

module.exports = router;
