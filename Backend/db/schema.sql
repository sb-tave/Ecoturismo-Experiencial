-- =====================================================================
-- Esquema de base de datos · Plataforma de ecoturismo (PostgreSQL 14+)
-- Implementa el modelo entidad-relación del proyecto. Es idempotente:
-- se puede ejecutar varias veces (npm run db:migrate).
-- =====================================================================

-- ---------- Usuario ----------
CREATE TABLE IF NOT EXISTS usuario (
  id_usuario           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre               VARCHAR(100) NOT NULL,
  correo               VARCHAR(150) NOT NULL,
  contrasena_hash      VARCHAR(255) NOT NULL,            -- hash bcrypt (RNF-02)
  telefono             VARCHAR(20),
  rol                  VARCHAR(20)  NOT NULL CHECK (rol IN ('TURISTA','ANFITRION','NEGOCIO_LOCAL','ADMINISTRADOR')),
  estado               VARCHAR(15)  NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','SUSPENDIDO','ELIMINADO')),
  politica_version     VARCHAR(10)  NOT NULL,            -- RNF-06: versión de la política aceptada
  politica_aceptada_en TIMESTAMPTZ  NOT NULL,            -- RNF-06: fecha de aceptación
  fecha_registro       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  eliminado_en         TIMESTAMPTZ                       -- RNF-07: fecha de anonimización de la cuenta
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuario_correo ON usuario (lower(correo));

-- ---------- Categoría ----------
CREATE TABLE IF NOT EXISTS categoria (
  id_categoria INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre       VARCHAR(80) NOT NULL,
  descripcion  VARCHAR(255),
  activa       BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_categoria_nombre ON categoria (lower(nombre));

-- ---------- Servicio (alojamientos, actividades y negocios locales) ----------
CREATE TABLE IF NOT EXISTS servicio (
  id_servicio           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_anfitrion          INT NOT NULL REFERENCES usuario(id_usuario),
  id_categoria          INT NOT NULL REFERENCES categoria(id_categoria),
  tipo                  VARCHAR(20)  NOT NULL CHECK (tipo IN ('ALOJAMIENTO','ACTIVIDAD','NEGOCIO_LOCAL')),
  titulo                VARCHAR(120) NOT NULL,
  descripcion           TEXT         NOT NULL,
  precio_base           NUMERIC(10,2) CHECK (precio_base >= 0),      -- por noche (alojamiento) o por persona (actividad)
  capacidad_max         INT CHECK (capacidad_max > 0),               -- máximo de personas por reserva
  localidad             VARCHAR(100) NOT NULL,                       -- pueblo o destino turístico
  direccion             VARCHAR(200),
  latitud               NUMERIC(9,6) CHECK (latitud BETWEEN -90 AND 90),
  longitud              NUMERIC(9,6) CHECK (longitud BETWEEN -180 AND 180),
  contacto              VARCHAR(150),                                -- teléfono o correo (negocios locales)
  estado                VARCHAR(15)  NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','OCULTO')),
  promedio_calificacion NUMERIC(3,2) CHECK (promedio_calificacion BETWEEN 1 AND 5),
  fecha_creacion        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_servicio_coordenadas CHECK ((latitud IS NULL) = (longitud IS NULL)),
  CONSTRAINT ck_servicio_reservable CHECK (tipo = 'NEGOCIO_LOCAL' OR (precio_base IS NOT NULL AND capacidad_max IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_servicio_busqueda  ON servicio (localidad, tipo, estado);
CREATE INDEX IF NOT EXISTS ix_servicio_geo       ON servicio (latitud, longitud);
CREATE INDEX IF NOT EXISTS ix_servicio_anfitrion ON servicio (id_anfitrion);
CREATE INDEX IF NOT EXISTS ix_servicio_categoria ON servicio (id_categoria);

-- ---------- Fotografías ----------
CREATE TABLE IF NOT EXISTS foto_servicio (
  id_foto      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_servicio  INT NOT NULL REFERENCES servicio(id_servicio) ON DELETE CASCADE,
  url          VARCHAR(255) NOT NULL,
  orden        SMALLINT NOT NULL DEFAULT 1,
  es_principal BOOLEAN  NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_foto_principal ON foto_servicio (id_servicio) WHERE es_principal;
CREATE INDEX IF NOT EXISTS ix_foto_servicio ON foto_servicio (id_servicio, orden);

-- ---------- Disponibilidad (cupos por servicio y por día) ----------
CREATE TABLE IF NOT EXISTS disponibilidad (
  id_disponibilidad INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_servicio       INT  NOT NULL REFERENCES servicio(id_servicio) ON DELETE CASCADE,
  fecha             DATE NOT NULL,
  cupos_totales     INT  NOT NULL CHECK (cupos_totales >= 0),
  cupos_disponibles INT  NOT NULL,
  version           INT  NOT NULL DEFAULT 1,                          -- control optimista de concurrencia (RNF-11)
  CONSTRAINT ck_disponibilidad_cupos CHECK (cupos_disponibles >= 0 AND cupos_disponibles <= cupos_totales),
  CONSTRAINT ux_disponibilidad UNIQUE (id_servicio, fecha)
);

-- ---------- Reserva ----------
CREATE TABLE IF NOT EXISTS reserva (
  id_reserva     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_turista     INT NOT NULL REFERENCES usuario(id_usuario),
  id_servicio    INT NOT NULL REFERENCES servicio(id_servicio),
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  num_personas   INT  NOT NULL CHECK (num_personas > 0),
  precio_total   NUMERIC(10,2) NOT NULL CHECK (precio_total >= 0),    -- siempre calculado en el backend
  estado         VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE_PAGO' CHECK (estado IN ('PENDIENTE_PAGO','CONFIRMADA','COMPLETADA','CANCELADA')),
  expira_en      TIMESTAMPTZ,                                         -- límite para pagar mientras está pendiente
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_reserva_fechas CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS ix_reserva_turista    ON reserva (id_turista, fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS ix_reserva_servicio   ON reserva (id_servicio, fecha_inicio);
CREATE INDEX IF NOT EXISTS ix_reserva_expiracion ON reserva (expira_en) WHERE estado = 'PENDIENTE_PAGO';

-- ---------- Pago (intentos de pago simulados) ----------
CREATE TABLE IF NOT EXISTS pago (
  id_pago             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_reserva          INT NOT NULL REFERENCES reserva(id_reserva),
  monto               NUMERIC(10,2) NOT NULL CHECK (monto >= 0),
  metodo              VARCHAR(30) NOT NULL,
  estado              VARCHAR(15) NOT NULL CHECK (estado IN ('APROBADO','RECHAZADO')),
  referencia_pasarela VARCHAR(60),                                    -- nunca se guardan datos de tarjeta (RNF-05)
  fecha_pago          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pago_reserva ON pago (id_reserva);

-- ---------- Calificación ----------
CREATE TABLE IF NOT EXISTS calificacion (
  id_calificacion INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_reserva      INT NOT NULL UNIQUE REFERENCES reserva(id_reserva), -- una calificación por reserva
  id_servicio     INT NOT NULL REFERENCES servicio(id_servicio),
  id_turista      INT NOT NULL REFERENCES usuario(id_usuario),
  puntuacion      SMALLINT NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario      TEXT,
  estado          VARCHAR(15) NOT NULL DEFAULT 'VISIBLE' CHECK (estado IN ('VISIBLE','OCULTA')),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_calificacion_servicio ON calificacion (id_servicio, estado);

-- ---------- Notificación ----------
CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario      INT NOT NULL REFERENCES usuario(id_usuario),
  tipo            VARCHAR(30)  NOT NULL,
  mensaje         VARCHAR(255) NOT NULL,
  leida           BOOLEAN NOT NULL DEFAULT false,
  fecha_envio     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notificacion_usuario ON notificacion (id_usuario, leida, fecha_envio DESC);

-- ---------- Denuncia (moderación de contenido) ----------
CREATE TABLE IF NOT EXISTS denuncia (
  id_denuncia      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_denunciante   INT NOT NULL REFERENCES usuario(id_usuario),
  id_servicio      INT REFERENCES servicio(id_servicio) ON DELETE CASCADE,
  id_calificacion  INT REFERENCES calificacion(id_calificacion) ON DELETE CASCADE,
  motivo           VARCHAR(255) NOT NULL,
  estado           VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','RESUELTA','DESESTIMADA')),
  id_admin         INT REFERENCES usuario(id_usuario),
  fecha_creacion   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_resolucion TIMESTAMPTZ,
  CONSTRAINT ck_denuncia_objetivo CHECK ((id_servicio IS NOT NULL)::int + (id_calificacion IS NOT NULL)::int = 1)
);
CREATE INDEX IF NOT EXISTS ix_denuncia_estado ON denuncia (estado, fecha_creacion);
CREATE UNIQUE INDEX IF NOT EXISTS ux_denuncia_pendiente_servicio ON denuncia (id_denunciante, id_servicio) WHERE estado = 'PENDIENTE' AND id_servicio IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_denuncia_pendiente_calificacion ON denuncia (id_denunciante, id_calificacion) WHERE estado = 'PENDIENTE' AND id_calificacion IS NOT NULL;
