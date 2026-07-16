const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/inventario.controller');

const router = express.Router();
router.use(requireAuth);

// Inventario es información interna: los dueños de mascota NO deberían verlo.
router.use(requireRole('admin', 'veterinario', 'recepcionista'));

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', requireRole('admin', 'recepcionista'), ctrl.crear);
router.put('/:id', requireRole('admin', 'recepcionista'), ctrl.actualizar);
router.delete('/:id', requireRole('admin'), ctrl.eliminar);

module.exports = router;
