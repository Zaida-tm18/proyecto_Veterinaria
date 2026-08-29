-- ============================================================
-- Veterinaria Jenny's - Esquema de base de datos PostgreSQL
-- ============================================================
-- Ejecutar con:  psql -U tu_usuario -d veterinaria -f schema.sql
-- ============================================================

-- Limpieza (solo para desarrollo, comenta esto en producción)
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
    activo          BOOLEAN       NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now()
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
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
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
    eliminado       BOOLEAN      NOT NULL DEFAULT false
);

-- ------------------------------------------------------------
-- Tratamientos
-- ------------------------------------------------------------
CREATE TABLE tratamientos (
    id              SERIAL PRIMARY KEY,
    mascota_id      INTEGER      NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'Activo'
                    CHECK (estado IN ('Activo','Finalizado')),
    diagnostico     VARCHAR(200) NOT NULL,
    tratamiento     TEXT,
    medicamento     VARCHAR(150),
    dosis           VARCHAR(100),
    frecuencia      VARCHAR(100),
    inicio          DATE,
    fin             DATE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado       BOOLEAN      NOT NULL DEFAULT false
);

-- ------------------------------------------------------------
-- Pagos
-- ------------------------------------------------------------
CREATE TABLE pagos (
    id              SERIAL PRIMARY KEY,
    mascota_id      INTEGER      NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
    fecha           DATE         NOT NULL DEFAULT CURRENT_DATE,
    concepto        VARCHAR(200) NOT NULL,
    monto           NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    metodo          VARCHAR(30)  NOT NULL,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'Pendiente'
                    CHECK (estado IN ('Pagado','Pendiente')),
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado       BOOLEAN      NOT NULL DEFAULT false
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
    eliminado       BOOLEAN      NOT NULL DEFAULT false
);

-- ------------------------------------------------------------
-- Índices útiles
-- ------------------------------------------------------------
CREATE INDEX idx_mascotas_dueno ON mascotas(dueno_id);
CREATE INDEX idx_citas_mascota ON citas(mascota_id);
CREATE INDEX idx_tratamientos_mascota ON tratamientos(mascota_id);
CREATE INDEX idx_pagos_mascota ON pagos(mascota_id);

-- ============================================================
-- Datos semilla
-- Contraseña para TODOS los usuarios de prueba: "123456"
-- El hash de abajo corresponde exactamente a "123456" (bcrypt, costo 10),
-- así que puedes usar este archivo tal cual sin generar nada extra.
-- Si quieres cambiar la contraseña semilla, genera un nuevo hash con:
--   node src/hashPassword.js tu_nueva_contraseña
-- ============================================================
INSERT INTO usuarios (nombre, correo, password_hash, rol, telefono) VALUES
('Administrador General', 'admin@veterinariajenny.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'admin', '555-0000'),
('Dra. Jenny Pérez', 'jenny@veterinariajenny.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'veterinario', '555-0001'),
('Dr. Miguel Sánchez', 'miguel@veterinariajenny.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'veterinario', '555-0002'),
('Recepción', 'recepcion@veterinariajenny.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'recepcionista', '555-0003'),
('Carlos Rodríguez', 'carlos@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0101'),
('María González', 'maria@example.com', '$2b$10$9QekV..bYk/sRAOmGlxNW..U22tEfQU3FRb5/QhJDKqTssNyZS4qG', 'dueno_mascota', '555-0102');

INSERT INTO mascotas (nombre, especie, raza, edad, dueno_id) VALUES
('Max', 'Perro', 'Labrador', '3 años', 5),
('Luna', 'Gato', 'Siamés', '2 años', 6);

INSERT INTO citas (mascota_id, fecha, hora, motivo, veterinario_id, estado) VALUES
(1, CURRENT_DATE, '09:00', 'Vacunación', 2, 'Confirmada'),
(2, CURRENT_DATE, '10:30', 'Consulta general', 3, 'Pendiente');

INSERT INTO inventario (producto, categoria, cantidad, unidad, minimo, precio, vencimiento) VALUES
('Alimento Premium Perros Adultos', 'Alimento', 40, 'kg', 20, 3.50, '2025-03-29'),
('Vacuna Antirrábica', 'Vacuna', 5, 'u', 20, 8.00, '2025-04-10'),
('Antibiótico Amoxicilina', 'Medicamento', 8, 'u', 15, 6.50, '2025-05-02');
