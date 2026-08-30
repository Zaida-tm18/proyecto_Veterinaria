-- ============================================================
-- Migración: liga tratamientos y pagos a la cita que los originó,
-- agrega el listado de insumos/medicamentos del tratamiento y deja
-- registro de quién emitió cada comprobante de pago (auditoría).
-- (Si vas a recrear la base desde cero, no necesitas esto: schema.sql
-- ya incluye todo lo de abajo.)
--
-- Ejecutar con:  psql -U tu_usuario -d veterinaria -f migracion_citas_tratamientos_pagos.sql
--
-- IMPORTANTE: los tratamientos y pagos que ya existían no tienen forma
-- de saber de qué cita salieron, así que esta migración los deja SIN
-- cita asociada (cita_id NULL) en vez de inventar una relación. Los
-- nuevos registros sí exigirán cita_id (tratamientos) o la aceptarán
-- opcionalmente (pagos).
-- ============================================================

ALTER TABLE tratamientos ADD COLUMN IF NOT EXISTS cita_id INTEGER REFERENCES citas(id) ON DELETE CASCADE;
ALTER TABLE tratamientos ADD COLUMN IF NOT EXISTS insumos TEXT;
CREATE INDEX IF NOT EXISTS idx_tratamientos_cita ON tratamientos(cita_id);

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS cita_id INTEGER REFERENCES citas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_cita ON pagos(cita_id);

-- "creado_por" no puede quedar NULL a futuro; a los pagos ya existentes
-- se les asigna el primer administrador como responsable registrado.
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS creado_por INTEGER REFERENCES usuarios(id);
UPDATE pagos SET creado_por = (SELECT id FROM usuarios WHERE rol = 'admin' ORDER BY id LIMIT 1)
WHERE creado_por IS NULL;
ALTER TABLE pagos ALTER COLUMN creado_por SET NOT NULL;
