-- ============================================================
-- Migración: pagos con varias formas de pago (ej. parte en efectivo
-- y parte con tarjeta), estado calculado automáticamente en vez de
-- elegido a mano, y dirección del usuario (para separar los datos
-- del cliente en el comprobante).
-- (Si vas a recrear la base desde cero, no necesitas esto: schema.sql
-- ya incluye todo lo de abajo.)
--
-- Ejecutar con:  psql -U tu_usuario -d veterinaria -f migracion_pagos_split.sql
-- ============================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS direccion VARCHAR(200);

CREATE TABLE IF NOT EXISTS pago_metodos (
    id              SERIAL PRIMARY KEY,
    pago_id         INTEGER      NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
    metodo          VARCHAR(30)  NOT NULL
                    CHECK (metodo IN ('Efectivo','Tarjeta de débito','Tarjeta de crédito','Transferencia')),
    monto           NUMERIC(10,2) NOT NULL CHECK (monto > 0)
);
CREATE INDEX IF NOT EXISTS idx_pago_metodos_pago ON pago_metodos(pago_id);

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Migra el método/estado que cada pago ya tenía a una única fila en
-- pago_metodos (asumiendo que se pagó todo con esa misma forma de pago).
INSERT INTO pago_metodos (pago_id, metodo, monto)
SELECT id, metodo, total FROM pagos
WHERE estado = 'Pagado' AND metodo IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pago_metodos WHERE pago_metodos.pago_id = pagos.id);

UPDATE pagos SET monto_pagado = total WHERE estado = 'Pagado';
-- Un "Pago parcial" viejo no registraba cuánto se había cobrado
-- realmente: se asume la mitad como aproximación razonable (ajústalo
-- a mano si conoces el monto real).
UPDATE pagos SET monto_pagado = ROUND(total / 2, 2) WHERE estado = 'Pago parcial';
INSERT INTO pago_metodos (pago_id, metodo, monto)
SELECT id, metodo, monto_pagado FROM pagos
WHERE estado = 'Pago parcial' AND metodo IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pago_metodos WHERE pago_metodos.pago_id = pagos.id);

ALTER TABLE pagos DROP COLUMN IF EXISTS metodo;
