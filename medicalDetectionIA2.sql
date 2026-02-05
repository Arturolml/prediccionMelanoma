-- =======================================================================================
-- SCRIPT BASE DE DATOS: DETECCIÓN DE MELANOMA (MedicalDetectionIA)
-- FECHA: 02/02/2026
-- VERSIÓN: 3.0 (Final)
-- =======================================================================================

-- 1. LIMPIEZA INICIAL (Borra tablas viejas para evitar conflictos)
DROP TABLE IF EXISTS evaluaciones CASCADE;
DROP TABLE IF EXISTS lesiones CASCADE;
DROP TABLE IF EXISTS pacientes CASCADE;
DROP TABLE IF EXISTS usuarios_sistema CASCADE;
DROP TYPE IF EXISTS tipo_sexo CASCADE;
DROP TYPE IF EXISTS tipo_diagnostico CASCADE;
DROP TYPE IF EXISTS tipo_rol CASCADE;

-- 2. CREACIÓN DE TIPOS DE DATOS (ENUMS)
CREATE TYPE tipo_sexo AS ENUM ('M', 'F', 'Otro');
CREATE TYPE tipo_diagnostico AS ENUM ('Benigno', 'Sospechoso', 'Maligno/Melanoma', 'Indeterminado');
CREATE TYPE tipo_rol AS ENUM ('admin', 'medico', 'enfermero');

-- 3. TABLA: USUARIOS DEL SISTEMA (Staff Médico y Admin)
CREATE TABLE usuarios_sistema (
    id_usuario INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Guardar siempre encriptado
    rol tipo_rol NOT NULL,
    cedula_profesional VARCHAR(50),      -- Requerido para recetas/diagnósticos
    telefono_contacto VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA: PACIENTES (Datos Personales y Factores de Riesgo)
CREATE TABLE pacientes (
    id_paciente INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Identificación (Formato México)
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(50) NOT NULL,
    apellido_materno VARCHAR(50), -- Opcional (NULL)
    curp VARCHAR(18) UNIQUE NOT NULL,

    -- Demográficos
    fecha_nacimiento DATE NOT NULL,
    sexo tipo_sexo NOT NULL,

    -- Factores de Riesgo (La IA usa esto)
    fototipo_fitzpatrick SMALLINT CHECK (fototipo_fitzpatrick BETWEEN 1 AND 6),

    -- CAMBIO: Antecedentes Familiares (Genética)
    antecedentes_familiares BOOLEAN DEFAULT FALSE, -- Bandera rápida para la IA
    notas_antecedentes TEXT,                       -- Detalle humano (Ej: "Madre con melanoma")

    -- Historial Personal (Recurrencia)
    historial_cancer_previo BOOLEAN DEFAULT FALSE, -- Alerta crítica: El paciente YA tuvo cáncer
    inmunosuprimido BOOLEAN DEFAULT FALSE,

    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA: LESIONES (Mapa del Cuerpo)
CREATE TABLE lesiones (
    id_lesion INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_paciente INT REFERENCES pacientes(id_paciente) ON DELETE CASCADE,
    zona_cuerpo VARCHAR(100) NOT NULL, -- Ej: 'Espalda Baja', 'Rostro'
    fecha_deteccion DATE DEFAULT CURRENT_DATE,
    notas_ubicacion TEXT -- Descripción extra: "Cerca del hombro derecho"
);

-- 6. TABLA: EVALUACIONES (El corazón del sistema: Fotos + IA + Médico)
CREATE TABLE evaluaciones (
    id_evaluacion INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_lesion INT REFERENCES lesiones(id_lesion) ON DELETE CASCADE,
    fecha_evaluacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Auditoría (Trazabilidad)
    id_usuario_registro INT REFERENCES usuarios_sistema(id_usuario), -- ¿Quién tomó la foto?
    id_medico_validador INT REFERENCES usuarios_sistema(id_usuario), -- ¿Quién firmó el diagnóstico?

    -- IA y Archivos
    ruta_imagen VARCHAR(255) NOT NULL,
    prediccion_ia NUMERIC(5, 2), -- Probabilidad (0.00 a 100.00)

    -- Criterios Clínicos (Regla ABCDE)
    asimetria BOOLEAN DEFAULT FALSE,
    bordes_irregulares BOOLEAN DEFAULT FALSE,
    color_variable BOOLEAN DEFAULT FALSE,
    diametro_mm DECIMAL(4, 1),
    evolucion_cambios BOOLEAN DEFAULT FALSE,

    -- Síntomas (Banderas Rojas)
    sintoma_sangrado BOOLEAN DEFAULT FALSE,
    sintoma_picazon BOOLEAN DEFAULT FALSE,
    sintoma_dolor BOOLEAN DEFAULT FALSE,
    sintoma_ulceracion BOOLEAN DEFAULT FALSE,

    -- Resultado Final
    diagnostico_medico tipo_diagnostico,
    notas_medico TEXT,
    requiere_biopsia BOOLEAN DEFAULT FALSE
);

-- 7. ÍNDICES DE RENDIMIENTO (Para búsquedas rápidas)
CREATE INDEX idx_usuario_email ON usuarios_sistema(email);
CREATE INDEX idx_paciente_curp ON pacientes(curp);
CREATE INDEX idx_paciente_paterno ON pacientes(apellido_paterno);
CREATE INDEX idx_evaluacion_fecha ON evaluaciones(fecha_evaluacion);

-- =======================================================================================
-- DATOS DE EJEMPLO (Para probar que todo funciona)
-- =======================================================================================

-- 1. Un Médico
INSERT INTO usuarios_sistema (nombre_completo, email, password_hash, rol, cedula_profesional)
VALUES ('Dr. Roberto House', 'house@hospital.com', 'hash_secreto', 'medico', '12345678');

-- 2. Un Paciente de prueba (Con antecedentes)
INSERT INTO pacientes (nombres, apellido_paterno, apellido_materno, curp, fecha_nacimiento, sexo, fototipo_fitzpatrick, antecedentes_familiares, notas_antecedentes)
VALUES ('Juan', 'Pérez', 'López', 'PELJ900101HDFR00', '1990-01-01', 'M', 2, TRUE, 'Padre finado por melanoma metastásico');
