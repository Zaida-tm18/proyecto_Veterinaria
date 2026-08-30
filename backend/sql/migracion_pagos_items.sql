-- ============================================================
-- Migración: pagos con detalle por ítems (productos/servicios),
-- IVA/subtotal/total, métodos de pago con tarjeta de crédito y
-- estado de pago con "Pago parcial".
-- (Si vas a recrear la base desde cero, no necesitas esto:
-- schema.sql ya incluye todo lo de abajo.)
--
-- Ejecutar con:  psql -U tu_usuario -d veterinaria -f migracion_pagos_items.sql
--
-- IMPORTANTE: esta migración traslada cada pago existente (que tenía
-- un solo concepto+monto) a una línea de "pago_items", y luego
-- reemplaza las columnas concepto/monto por subtotal/iva/total.
-- Haz un respaldo (pg_dump) antes de correrla en una base con datos reales.
-- ============================================================

CREATE TABLE IF NOT EXISTS pago_items (
    id              SERIAL PRIMARY KEY,
    pago_id         INTEGER      NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
    concepto        VARCHAR(200) NOT NULL,
    cantidad        NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal        NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pago_items_pago ON pago_items(pago_id);

-- Migra cada pago viejo (concepto/monto) a una línea de detalle única.
INSERT INTO pago_items (pago_id, concepto, cantidad, precio_unitario, subtotal)
SELECT id, concepto, 1, monto, monto
FROM pagos
WHERE NOT EXISTS (SELECT 1 FROM pago_items WHERE pago_items.pago_id = pagos.id);

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS iva      NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS total    NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Calcula subtotal/iva(15%)/total a partir del monto que tenía cada pago.
UPDATE pagos SET
  subtotal = ROUND(monto / 1.15, 2),
  iva      = monto - ROUND(monto / 1.15, 2),
  total    = monto
WHERE monto IS NOT NULL;

ALTER TABLE pagos DROP COLUMN IF EXISTS concepto;
ALTER TABLE pagos DROP COLUMN IF EXISTS monto;

-- Amplía el estado ("Pendiente" -> "No pagado") y el método de pago.
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_estado_check;
UPDATE pagos SET estado = 'No pagado' WHERE estado = 'Pendiente';
ALTER TABLE pagos ADD CONSTRAINT pagos_estado_check CHECK (estado IN ('Pagado','Pago parcial','No pagado'));
ALTER TABLE pagos ALTER COLUMN estado SET DEFAULT 'No pagado';

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;
UPDATE pagos SET metodo = 'Tarjeta de débito' WHERE metodo = 'Tarjeta';
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_check
  CHECK (metodo IN ('Efectivo','Tarjeta de débito','Tarjeta de crédito','Transferencia'));
