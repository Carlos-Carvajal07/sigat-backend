require('dotenv').config();
const db = require('../config/database');

const SQL = `
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  login         VARCHAR(50) UNIQUE NOT NULL,
  nombre        VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(50)  NOT NULL DEFAULT 'Funcionario',
  area          VARCHAR(100),
  carrera       VARCHAR(150),
  correo        VARCHAR(150),
  estado        VARCHAR(20)  NOT NULL DEFAULT 'Activo',
  refresh_token TEXT,
  ultimo_acceso TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id                  SERIAL PRIMARY KEY,
  codigo              VARCHAR(20) UNIQUE NOT NULL,
  fecha_creacion      DATE DEFAULT CURRENT_DATE,
  fecha_fin           DATE,
  fecha_comprometida  DATE,
  tipo_sol            VARCHAR(20)  DEFAULT 'Interno',
  nombre_sol          VARCHAR(200) NOT NULL,
  unidad_sol          VARCHAR(200),
  contacto_sol        VARCHAR(200),
  canal               VARCHAR(50),
  tipo_req            VARCHAR(100),
  descripcion         TEXT,
  prioridad           VARCHAR(20)  DEFAULT 'Media',
  estado              VARCHAR(30)  DEFAULT 'Abierto',
  responsable_id      INTEGER REFERENCES usuarios(id),
  fecha_asignacion    DATE,
  fecha_cierre        TIMESTAMP,
  duracion            DECIMAL(6,2) DEFAULT 0,
  tiempo_optimo       DECIMAL(6,2) DEFAULT 0,
  comentario_interno  TEXT,
  sla_cumplido        BOOLEAN DEFAULT TRUE,
  created_by          INTEGER REFERENCES usuarios(id),
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actividades (
  id                  SERIAL PRIMARY KEY,
  titulo              VARCHAR(255) NOT NULL,
  descripcion         TEXT,
  area                VARCHAR(100),
  tipo                VARCHAR(100),
  subtipo             VARCHAR(100),
  responsable         VARCHAR(150),
  fecha               DATE,
  hora_inicio         VARCHAR(10),
  hora_fin            VARCHAR(10),
  duracion            DECIMAL(6,2) DEFAULT 0,
  prioridad           VARCHAR(20)  DEFAULT 'Media',
  estado              VARCHAR(50)  DEFAULT 'Pendiente',
  tipo_sol            VARCHAR(20),
  nombre_sol          VARCHAR(200),
  unidad_sol          VARCHAR(200),
  contacto_sol        VARCHAR(200),
  desc_sol            TEXT,
  ticket_id           INTEGER REFERENCES tickets(id),
  meta                VARCHAR(255),
  observaciones       TEXT,
  objetivo            TEXT,
  unidad_participante VARCHAR(200),
  acuerdos            TEXT,
  responsables_comp   TEXT,
  fecha_seguimiento   DATE,
  estado_cumplimiento VARCHAR(50),
  links               TEXT,
  created_by          INTEGER REFERENCES usuarios(id),
  modified_by         INTEGER REFERENCES usuarios(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actividades_embajador (
  id                  SERIAL PRIMARY KEY,
  fecha               DATE NOT NULL,
  actividad           VARCHAR(255) NOT NULL,
  establecimiento     VARCHAR(255) NOT NULL,
  contacto            VARCHAR(150),
  cargo               VARCHAR(100),
  ciudad              VARCHAR(100),
  comuna              VARCHAR(100),
  horario             VARCHAR(100),
  horas               DECIMAL(5,2) DEFAULT 0,
  telefono            VARCHAR(50),
  correo              VARCHAR(150),
  lugar               VARCHAR(255),
  estado              VARCHAR(50)  DEFAULT 'Programada',
  comentario          TEXT,
  comentario_fecha    TIMESTAMP,
  traslado            VARCHAR(50),
  alimentacion        VARCHAR(50),
  num_estudiantes     INTEGER DEFAULT 0,
  cursos              VARCHAR(255),
  carreras            TEXT,
  observaciones_cierre TEXT,
  compromisos         TEXT,
  evaluacion          VARCHAR(50),
  cierre_por          VARCHAR(100),
  fecha_cierre        TIMESTAMP,
  created_by          INTEGER REFERENCES usuarios(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asignaciones_embajador (
  id                SERIAL PRIMARY KEY,
  actividad_id      INTEGER NOT NULL REFERENCES actividades_embajador(id) ON DELETE CASCADE,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  respuesta         VARCHAR(20),
  fecha_respuesta   TIMESTAMP,
  disp_estado       VARCHAR(20) DEFAULT 'conflicto',
  asignacion_manual BOOLEAN DEFAULT FALSE,
  motivo_manual     TEXT,
  disp_confirmada   VARCHAR(20) DEFAULT 'Pendiente',
  asignado_por      INTEGER REFERENCES usuarios(id),
  fecha_asignacion  TIMESTAMP DEFAULT NOW(),
  UNIQUE(actividad_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS disponibilidad (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dia               INTEGER NOT NULL CHECK(dia BETWEEN 1 AND 7),
  hora_inicio       TIME NOT NULL,
  hora_fin          TIME NOT NULL,
  origen            VARCHAR(20) DEFAULT 'manual',
  fecha_actualizacion DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint    TEXT UNIQUE NOT NULL,
  p256dh      TEXT,
  auth        TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id           SERIAL PRIMARY KEY,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo       VARCHAR(255) NOT NULL,
  cuerpo       TEXT,
  actividad_id INTEGER,
  leida        BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER REFERENCES usuarios(id),
  accion         VARCHAR(50) NOT NULL,
  modulo         VARCHAR(100),
  campo          VARCHAR(100),
  valor_anterior TEXT,
  valor_nuevo    TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_estado    ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_actividades_fecha ON actividades(fecha);
CREATE INDEX IF NOT EXISTS idx_act_emb_fecha     ON actividades_embajador(fecha);
CREATE INDEX IF NOT EXISTS idx_asig_usuario      ON asignaciones_embajador(usuario_id);
CREATE INDEX IF NOT EXISTS idx_disp_usuario      ON disponibilidad(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_usuario     ON notificaciones(usuario_id,leida);
`;

db.query(SQL)
  .then(() => { console.log('✅ Migración completada'); process.exit(0); })
  .catch(e  => { console.error('❌ Error:', e.message); process.exit(1); });
