const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/mascotas.controller');

const router = express.Router();

// Todas las rutas requieren estar autenticado.
router.use(requireAuth);

// Todos los roles pueden listar/ver (el controlador filtra por dueño cuando aplica).
router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);

// Crear/editar: todos los roles pueden (un dueño registra sus propias mascotas).
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);

// Eliminar: solo staff de la clínica o el propio dueño (se valida dentro del controlador).
router.delete('/:id', requireRole('admin', 'veterinario', 'recepcionista', 'dueno_mascota'), ctrl.eliminar);

module.exports = router;
