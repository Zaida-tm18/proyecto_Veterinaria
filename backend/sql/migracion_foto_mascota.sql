-- ============================================================
-- Migración: agrega la foto de la mascota a bases ya existentes
-- (si vas a recrear la base desde cero, no necesitas esto:
-- schema.sql ya incluye la columna).
--
-- Ejecutar con:  psql -U tu_usuario -d veterinaria -f migracion_foto_mascota.sql
-- ============================================================
ALTER TABLE mascotas ADD COLUMN IF NOT EXISTS foto_data TEXT;
