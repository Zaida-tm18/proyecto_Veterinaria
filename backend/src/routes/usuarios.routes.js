const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/usuarios.controller');

const router = express.Router();
router.use(requireAuth);

// Solo el personal de la clínica necesita ver esta lista (para asignar
// dueños a mascotas o veterinarios a citas). Un dueño de mascota no
// necesita ni debe ver el listado completo de usuarios.
router.get('/', requireRole('admin', 'veterinario', 'recepcionista'), ctrl.listar);

// Gestión completa de usuarios: exclusiva del admin.
router.get('/:id', requireRole('admin'), ctrl.obtener);
router.post('/', requireRole('admin'), ctrl.crear);
router.put('/:id', requireRole('admin'), ctrl.actualizar);

module.exports = router;
