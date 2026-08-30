-- ============================================================
-- Veterinaria Jenny's - Esquema de base de datos PostgreSQL
-- ============================================================
-- Ejecutar con:  psql -U tu_usuario -d veterinaria -f schema.sql
-- ============================================================

-- Limpieza (solo para desarrollo, comenta esto en producción)
DROP TABLE IF EXISTS pago_metodos CASCADE;
DROP TABLE IF EXISTS pago_items CASCADE;
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS tratamientos CASCADE;
DROP TABLE IF EXISTS citas CASCADE;
DROP TABLE IF EXISTS inventario CASCADE;
DROP TABLE IF EXISTS mascotas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS configuracion CASCADE;
DROP TYPE IF EXISTS rol_usuario;

-- ------------------------------------------------------------
-- Tipo enumerado de roles
-- ------------------------------------------------------------
CREATE TYPE rol_usuario AS ENUM ('admin', 'veterinario', 'recepcionista', 'dueno_mascota');

-- ------------------------------------------------------------
-- Usuarios (login del sistema)
-- ------------------------------------------------------------
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(120)  NOT NULL,
    correo          VARCHAR(150)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255)  NOT NULL,
    rol             rol_usuario   NOT NULL DEFAULT 'dueno_mascota',
    telefono        VARCHAR(30),
    direccion       VARCHAR(200),
    activo          BOOLEAN       NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Mascotas
-- Cada mascota pertenece a un usuario con rol 'dueno_mascota'
-- ------------------------------------------------------------
CREATE TABLE mascotas (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    especie         VARCHAR(50)  NOT NULL,
    raza            VARCHAR(100),
    edad            VARCHAR(50),
    dueno_id        INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    foto_data       TEXT,                    -- foto de la mascota en base64 (data URL)
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado       BOOLEAN      NOT NULL DEFAULT false  -- soft delete (papelera)
);

-- ------------------------------------------------------------
-- Citas
-- ------------------------------------------------------------
CREATE TABLE citas (
    id              SERIAL PRIMARY KEY,
    mascota_id      INTEGER      NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    fecha           DATE         NOT NULL,
    hora            TIME         NOT NULL,
    motivo          VARCHAR(200) NOT NULL,
    veterinario_id  INTEGER      REFERENCES usuarios(id),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'Pendiente'
                    CHECK (estado IN ('Confirmada','Pendiente','Cancelada','Completada')),
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado       BOOLEAN      NOT NULL DEFAULT false
);

-- ------------------------------------------------------------
-- Tratamientos
-- Cada tratamiento nace de una cita médica puntual (cita_id): así se
-- ve desde qué visita lo indicó el veterinario. Una misma cita puede
-- tener varios tratamientos (ej. un diagnóstico principal + uno
-- secundario), cada uno con su propio diagnóstico e insumos/medicamentos.
-- ------------------------------------------------------------
CREATE TABLE tratamientos (
    id              SERIAL PRIMARY KEY,
    cita_id         INTEGER      NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
    mascota_id      INTEGER      NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'Activo'
                    CHECK (estado IN ('Activo','Finalizado')),
    diagnostico     VARCHAR(200) NOT NULL,
    tratamiento     TEXT,
    medicamento     VARCHAR(150),
    dosis           VARCHAR(100),
    frecuencia      VARCHAR(100),
    insumos         TEXT,                    -- listado libre de medicamentos/utensilios que requiere
    inicio          DATE,
    fin             DATE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado       BOOLEAN      NOT NULL DEFAULT false
);

-- ------------------------------------------------------------
-- Pagos
-- Un pago es el encabezado del comprobante de venta: los totales
-- (subtotal/IVA/total), calculados a partir de sus líneas de detalle
-- en "pago_items" (productos y/o servicios), y cuánto se ha cobrado
-- realmente ("monto_pagado"), calculado a su vez desde "pago_metodos"
-- (puede pagarse dividido entre varias formas de pago, ej. una parte
-- en efectivo y otra con tarjeta). "estado" NUNCA se elige a mano:
-- se deriva de monto_pagado vs. total (ver calcularEstadoPago en el
-- controlador).
-- ------------------------------------------------------------
CREATE TABLE pagos (
    id              SERIAL PRIMARY KEY,
    mascota_id      INTEGER      NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    cita_id         INTEGER      REFERENCES citas(id) ON DELETE SET NULL, -- visita que originó el cobro (opcional: también se venden productos sueltos)
    creado_por      INTEGER      NOT NULL REFERENCES usuarios(id),        -- quién emitió el comprobante (auditoría)
    fecha           DATE         NOT NULL DEFAULT CURRENT_DATE,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'No pagado'
                    CHECK (estado IN ('Pagado','Pago parcial','No pagado')),
    subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
    iva             NUMERIC(10,2) NOT NULL DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL DEFAULT 0,
    monto_pagado    NUMERIC(10,2) NOT NULL DEFAULT 0,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado       BOOLEAN      NOT NULL DEFAULT false
);

-- Líneas de detalle de cada pago (productos y/o servicios comprados).
CREATE TABLE pago_items (
    id              SERIAL PRIMARY KEY,
    pago_id         INTEGER      NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
    concepto        VARCHAR(200) NOT NULL,
    cantidad        NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal        NUMERIC(10,2) NOT NULL
);

-- Formas de pago con las que se cubrió el comprobante. Puede haber
-- varias por pago (ej. $300 en efectivo + $200 con tarjeta de débito).
CREATE TABLE pago_metodos (
    id              SERIAL PRIMARY KEY,
    pago_id         INTEGER      NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
    metodo          VARCHAR(30)  NOT NULL
                    CHECK (metodo IN ('Efectivo','Tarjeta de débito','Tarjeta de crédito','Transferencia')),
    monto           NUMERIC(10,2) NOT NULL CHECK (monto > 0)
);

-- ------------------------------------------------------------
-- Configuración de la clínica
-- Fila única (id fijo = 1) con los datos generales del negocio:
-- nombre, logo (en base64), dirección, teléfono y correo de contacto.
-- El admin la edita desde el módulo de Configuración.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS configuracion CASCADE;
CREATE TABLE configuracion (
    id              INTEGER      PRIMARY KEY DEFAULT 1,
    nombre_clinica  VARCHAR(150) NOT NULL DEFAULT 'Veterinaria Jenny''s',
    logo_data       TEXT,                    -- imagen en base64 (data URL)
    direccion       VARCHAR(200),
    telefono        VARCHAR(30),
    correo_contacto VARCHAR(150),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT configuracion_singleton CHECK (id = 1)
);

INSERT INTO configuracion (id, nombre_clinica) VALUES (1, 'Veterinaria Jenny''s');

-- ------------------------------------------------------------
-- Inventario (no depende de mascotas ni usuarios)
-- ------------------------------------------------------------
CREATE TABLE inventario (
    id              SERIAL PRIMARY KEY,
    producto        VARCHAR(150) NOT NULL,
    categoria       VARCHAR(50)  NOT NULL,
    cantidad        NUMERIC(10,2) NOT NULL DEFAULT 0,
    unidad          VARCHAR(20)  NOT NULL,
    minimo          NUMERIC(10,2) NOT NULL DEFAULT 0,
    precio          NUMERIC(10,2) NOT NULL DEFAULT 0,
    vencimiento     DATE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado       BOOLEAN      NOT NULL DEFAULT false
);

-- ------------------------------------------------------------
-- Índices útiles
-- ------------------------------------------------------------
CREATE INDEX idx_mascotas_dueno ON mascotas(dueno_id);
CREATE INDEX idx_citas_mascota ON citas(mascota_id);
CREATE INDEX idx_tratamientos_mascota ON tratamientos(mascota_id);
CREATE INDEX idx_tratamientos_cita ON tratamientos(cita_id);
CREATE INDEX idx_pagos_mascota ON pagos(mascota_id);
CREATE INDEX idx_pagos_cita ON pagos(cita_id);
CREATE INDEX idx_pago_items_pago ON pago_items(pago_id);
CREATE INDEX idx_pago_metodos_pago ON pago_metodos(pago_id);

-- ============================================================
-- Datos semilla
-- Contraseña para TODOS los usuarios de prueba: "123456"
-- El hash de abajo corresponde exactamente a "123456" (bcrypt, costo 10),
-- así que puedes usar este archivo tal cual sin generar nada extra.
-- Si quieres cambiar la contraseña semilla, genera un nuevo hash con:
--   node src/hashPassword.js tu_nueva_contraseña
-- ============================================================
INSERT INTO usuarios (nombre, correo, password_hash, rol, telefono, direccion) VALUES
('Administrador General', 'admin@veterinariajenny.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'admin', '555-0000', NULL),
('Jenny Pérez', 'jenny@veterinariajenny.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'veterinario', '555-0001', NULL),
('Miguel Sánchez', 'miguel@veterinariajenny.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'veterinario', '555-0002', NULL),
('Valeria Rojas', 'recepcion@veterinariajenny.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'recepcionista', '555-0003', NULL),
-- 10 dueños de mascota (ids 5-14) para tener suficiente volumen de datos de prueba.
('Carlos Rodríguez', 'carlos@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0101', 'Av. Amazonas N34-56, Quito'),
('María González', 'maria@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0102', 'Calle Los Cerezos 123, Quito'),
('Ana Torres', 'ana.torres@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0103', 'Av. 6 de Diciembre y Colón, Quito'),
('Luis Fernández', 'luis.fernandez@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0104', 'Ciudadela La Kennedy, Guayaquil'),
('Sofía Ramírez', 'sofia.ramirez@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0105', 'Urb. Los Álamos, Cuenca'),
('Jorge Castillo', 'jorge.castillo@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0106', 'Av. Rumiñahui 245, Sangolquí'),
('Patricia Vera', 'patricia.vera@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0107', 'Calle Bolívar y Sucre, Ambato'),
('Diego Morales', 'diego.morales@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0108', 'Cdla. Kennedy Norte, Guayaquil'),
('Camila Ortiz', 'camila.ortiz@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0109', 'Av. González Suárez 780, Quito'),
('Andrés Salazar', 'andres.salazar@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0110', 'Calle Larga 456, Cuenca');

-- 10 mascotas (ids 1-10), una por cada dueño de arriba.
INSERT INTO mascotas (nombre, especie, raza, edad, dueno_id) VALUES
('Max', 'Perro', 'Labrador', '3 años', 5),
('Luna', 'Gato', 'Siamés', '2 años', 6),
('Rocky', 'Perro', 'Bulldog', '4 años', 7),
('Milo', 'Gato', 'Persa', '1 año', 8),
('Nina', 'Perro', 'Poodle', '5 años', 9),
('Toby', 'Perro', 'Beagle', '2 años', 10),
('Kiara', 'Gato', 'Angora', '3 años', 11),
('Simón', 'Perro', 'Pastor Alemán', '6 años', 12),
('Bella', 'Gato', 'Común Europeo', '2 años', 13),
('Zeus', 'Perro', 'Rottweiler', '4 años', 14);

-- 12 citas (ids 1-12): varias ya completadas (para colgarles tratamientos y
-- pagos) y otras todavía pendientes/confirmadas (sin tratamiento ni cobro).
INSERT INTO citas (mascota_id, fecha, hora, motivo, veterinario_id, estado) VALUES
(1,  CURRENT_DATE,                        '09:00', 'Vacunación',                  2, 'Confirmada'),
(2,  CURRENT_DATE,                        '10:30', 'Consulta general',            3, 'Pendiente'),
(3,  CURRENT_DATE - INTERVAL '1 day',     '11:00', 'Control de peso',             2, 'Completada'),
(4,  CURRENT_DATE - INTERVAL '2 days',    '08:30', 'Desparasitación',             3, 'Completada'),
(5,  CURRENT_DATE,                        '14:00', 'Consulta general',            2, 'Confirmada'),
(6,  CURRENT_DATE + INTERVAL '1 day',     '09:30', 'Vacunación',                  3, 'Pendiente'),
(7,  CURRENT_DATE - INTERVAL '3 days',    '15:00', 'Cirugía menor',               2, 'Completada'),
(8,  CURRENT_DATE + INTERVAL '2 days',    '10:00', 'Revisión post-operatoria',    2, 'Pendiente'),
(9,  CURRENT_DATE - INTERVAL '1 day',     '16:00', 'Consulta general',            3, 'Completada'),
(10, CURRENT_DATE,                        '11:30', 'Emergencia',                  2, 'Confirmada'),
(1,  CURRENT_DATE + INTERVAL '3 days',    '09:00', 'Control de vacuna',           2, 'Pendiente'),
(3,  CURRENT_DATE + INTERVAL '1 day',     '13:00', 'Seguimiento de tratamiento',  2, 'Pendiente');

-- 11 tratamientos, cada uno colgado de la cita que lo originó. La cita 1
-- muestra a propósito 3 tratamientos (más de dos) para la misma visita.
INSERT INTO tratamientos (cita_id, mascota_id, estado, diagnostico, tratamiento, medicamento, dosis, frecuencia, insumos, inicio, fin) VALUES
(1, 1, 'Activo',     'Sarna leve',                 'Baño medicado semanal',        'Ivermectina',       '0.2 ml/kg',   'Cada 7 días',            'Shampoo antisárnico, guantes desechables', CURRENT_DATE, CURRENT_DATE + INTERVAL '21 days'),
(1, 1, 'Activo',     'Deficiencia vitamínica',     'Suplementación vitamínica',    'Complejo B',        '1 tableta',   'Diaria',                 'Vitaminas orales',                          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days'),
(1, 1, 'Finalizado', 'Revisión dental de rutina',  'Limpieza dental preventiva',   NULL,                NULL,          NULL,                     'Cepillo y pasta dental veterinaria',        CURRENT_DATE, CURRENT_DATE),
(3, 3, 'Finalizado', 'Sobrepeso moderado',         'Dieta controlada',             NULL,                NULL,          NULL,                     'Alimento light, báscula',                   CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '29 days'),
(3, 3, 'Finalizado', 'Sarro leve',                 'Limpieza dental',              NULL,                NULL,          NULL,                     'Kit de limpieza dental',                    CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day'),
(4, 4, 'Finalizado', 'Parásitos intestinales',     'Desparasitación oral',         'Praziquantel',      '1 tableta',   'Dosis única',            'Tableta desparasitante',                    CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '2 days'),
(7, 7, 'Activo',     'Quiste sebáceo',             'Extirpación quirúrgica',       'Amoxicilina',       '50 mg/12h',   'Cada 12 horas por 7 días', 'Gasas, suturas, antiséptico',             CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days'),
(7, 7, 'Activo',     'Dolor postoperatorio',       'Manejo del dolor',             'Tramadol',          '2 mg/kg',     'Cada 8 horas',           'Analgésico inyectable',                     CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '2 days'),
(9, 9, 'Activo',     'Otitis leve',                'Limpieza y gotas óticas',      'Otibiótic',         '3 gotas',     'Cada 12 horas por 10 días', 'Gotas óticas, algodón',                  CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '9 days'),
(9, 9, 'Activo',     'Alergia cutánea',            'Antihistamínico',              'Cetirizina',        '5 mg',        'Diaria por 5 días',      'Antihistamínico oral',                      CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '4 days'),
(10, 10, 'Activo',   'Intoxicación alimentaria',   'Lavado gástrico y sueroterapia', 'Suero fisiológico', 'IV según peso', 'Sesión única',       'Suero, catéter',                            CURRENT_DATE, CURRENT_DATE);

-- 10 pagos (comprobantes de venta). Algunos ligados a la cita que los
-- generó (consulta + medicamentos/insumos de ese tratamiento) y otros por
-- productos sueltos comprados sin una visita asociada. "creado_por" deja
-- registrado quién emitió cada comprobante (admin=1, recepción=4).
-- "estado" y "monto_pagado" reflejan lo que quedó registrado en
-- pago_metodos más abajo (nunca se elige el estado a mano).
INSERT INTO pagos (mascota_id, cita_id, creado_por, fecha, estado, subtotal, iva, total, monto_pagado) VALUES
(1,  1,    4, CURRENT_DATE,                     'Pagado',       46.50, 6.98,  53.48,  53.48),
(2,  2,    4, CURRENT_DATE,                     'No pagado',    20.00, 3.00,  23.00,   0.00),
(3,  3,    1, CURRENT_DATE - INTERVAL '1 day',  'Pagado',       47.00, 7.05,  54.05,  54.05),
(4,  4,    4, CURRENT_DATE - INTERVAL '2 days', 'Pagado',       23.00, 3.45,  26.45,  26.45),
(5,  NULL, 4, CURRENT_DATE,                     'Pagado',       17.50, 2.63,  20.13,  20.13),
(7,  7,    1, CURRENT_DATE - INTERVAL '3 days', 'Pago parcial',153.00, 22.95, 175.95, 100.00),
(9,  9,    4, CURRENT_DATE - INTERVAL '1 day',  'Pagado',       36.00, 5.40,  41.40,  41.40),
(10, 10,   1, CURRENT_DATE,                     'Pago parcial', 74.00, 11.10, 85.10,  50.00),
(6,  NULL, 4, CURRENT_DATE - INTERVAL '4 days', 'No pagado',     8.00,  1.20,  9.20,   0.00),
(8,  NULL, 4, CURRENT_DATE - INTERVAL '5 days', 'Pagado',       19.00, 2.85,  21.85,  21.85);

-- Formas de pago de cada comprobante (algunas divididas entre dos
-- métodos, como pidió el negocio: parte en efectivo y parte con tarjeta).
INSERT INTO pago_metodos (pago_id, metodo, monto) VALUES
(1, 'Efectivo', 30.00),
(1, 'Tarjeta de débito', 23.48),
(3, 'Efectivo', 54.05),
(4, 'Transferencia', 26.45),
(5, 'Tarjeta de crédito', 20.13),
(6, 'Efectivo', 60.00),
(6, 'Tarjeta de crédito', 40.00),
(7, 'Efectivo', 41.40),
(8, 'Efectivo', 30.00),
(8, 'Tarjeta de débito', 20.00),
(10, 'Efectivo', 21.85);
-- Los pagos 2 (No pagado) y 9 (No pagado) no tienen filas aquí: todavía no se ha cobrado nada.

-- Detalle de cada comprobante (productos/servicios cobrados).
INSERT INTO pago_items (pago_id, concepto, cantidad, precio_unitario, subtotal) VALUES
(1, 'Consulta veterinaria', 1, 20.00, 20.00),
(1, 'Ivermectina', 1, 8.50, 8.50),
(1, 'Shampoo antisárnico', 1, 12.00, 12.00),
(1, 'Complejo B vitamínico', 1, 6.00, 6.00),
(2, 'Consulta general', 1, 20.00, 20.00),
(3, 'Control de peso', 1, 15.00, 15.00),
(3, 'Alimento light (2kg)', 2, 3.50, 7.00),
(3, 'Limpieza dental', 1, 25.00, 25.00),
(4, 'Desparasitación', 1, 18.00, 18.00),
(4, 'Praziquantel', 1, 5.00, 5.00),
(5, 'Alimento Premium Perros Adultos (5kg)', 5, 3.50, 17.50),
(6, 'Cirugía menor - extirpación de quiste', 1, 120.00, 120.00),
(6, 'Amoxicilina postoperatoria', 1, 15.00, 15.00),
(6, 'Tramadol (analgésico)', 1, 10.00, 10.00),
(6, 'Gasas y suturas', 1, 8.00, 8.00),
(7, 'Consulta general', 1, 20.00, 20.00),
(7, 'Gotas óticas', 1, 9.00, 9.00),
(7, 'Cetirizina', 1, 7.00, 7.00),
(8, 'Atención de emergencia', 1, 60.00, 60.00),
(8, 'Suero fisiológico', 2, 4.00, 8.00),
(8, 'Catéter', 1, 6.00, 6.00),
(9, 'Vacuna antirrábica', 1, 8.00, 8.00),
(10, 'Revisión post-operatoria', 1, 15.00, 15.00),
(10, 'Antiséptico', 1, 4.00, 4.00);

-- 10 productos de inventario (el último queda deliberadamente por debajo
-- del mínimo, para probar la alerta de stock bajo).
INSERT INTO inventario (producto, categoria, cantidad, unidad, minimo, precio, vencimiento) VALUES
('Alimento Premium Perros Adultos', 'Alimento', 40, 'kg', 20, 3.50, '2026-11-29'),
('Vacuna Antirrábica', 'Vacuna', 5, 'u', 20, 8.00, '2026-12-10'),
('Antibiótico Amoxicilina', 'Medicamento', 8, 'u', 15, 6.50, '2027-01-02'),
('Alimento Gatos Adultos', 'Alimento', 25, 'kg', 15, 4.20, '2026-12-01'),
('Guantes de látex', 'Insumo', 200, 'u', 50, 0.15, NULL),
('Jeringas 5ml', 'Insumo', 150, 'u', 40, 0.25, NULL),
('Suero Fisiológico 500ml', 'Medicamento', 30, 'u', 10, 3.00, '2027-02-15'),
('Shampoo Antipulgas', 'Insumo', 20, 'u', 10, 6.00, '2027-06-10'),
('Colonia para mascotas', 'Insumo', 15, 'u', 5, 5.50, NULL),
('Colágeno articular para perros', 'Medicamento', 12, 'u', 15, 14.00, '2027-04-20');

-- Servicios veterinarios (misma tabla de inventario, categoría "Servicio":
-- no se controla stock, pero así el cobro de un pago se elige de esta
-- misma lista en vez de escribirse a mano, con precio unitario ya cargado).
INSERT INTO inventario (producto, categoria, cantidad, unidad, minimo, precio, vencimiento) VALUES
('Consulta general', 'Servicio', 9999, 'u', 0, 20.00, NULL),
('Vacunación', 'Servicio', 9999, 'u', 0, 15.00, NULL),
('Desparasitación', 'Servicio', 9999, 'u', 0, 18.00, NULL),
('Cirugía menor', 'Servicio', 9999, 'u', 0, 120.00, NULL),
('Limpieza dental', 'Servicio', 9999, 'u', 0, 25.00, NULL),
('Atención de emergencia', 'Servicio', 9999, 'u', 0, 60.00, NULL),
('Revisión post-operatoria', 'Servicio', 9999, 'u', 0, 15.00, NULL);
