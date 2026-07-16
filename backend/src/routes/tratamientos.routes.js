const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/tratamientos.controller');

const router = express.Router();
router.use(requireAuth);

// Todos los roles autenticados pueden leer (el controlador filtra por dueño).
router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);

// Solo el personal clínico puede escribir historiales médicos.
router.post('/', requireRole('admin', 'veterinario'), ctrl.crear);
router.put('/:id', requireRole('admin', 'veterinario'), ctrl.actualizar);
router.delete('/:id', requireRole('admin', 'veterinario'), ctrl.eliminar);

module.exports = router;
