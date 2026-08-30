-- ============================================================
-- Migración: agrega "actualizado_en" a las tablas que no lo tenían,
-- para poder ordenar los listados por última edición (más reciente
-- o más antiguo primero) y que un registro recién editado aparezca
-- primero en su lista.
-- (Si vas a recrear la base desde cero, no necesitas esto: schema.sql
-- ya incluye todo lo de abajo.)
--
-- Ejecutar con:  psql -U tu_usuario -d veterinaria -f migracion_actualizado_en.sql
-- ============================================================

ALTER TABLE usuarios     ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE mascotas     ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE citas        ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE tratamientos ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE pagos        ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE inventario   ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
