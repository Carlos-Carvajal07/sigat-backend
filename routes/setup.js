const router = require('express').Router();
const db     = require('../config/database');
const bcrypt = require('bcryptjs');

// Endpoint protegido para ejecutar migraciones sin acceso a shell
// Usar solo una vez, luego eliminar o deshabilitar
router.get('/run/:key', async (req, res) => {
  const SECRET = process.env.SETUP_KEY || 'sigat-setup-2024';
  if (req.params.key !== SECRET) {
    return res.status(403).json({ error: 'Clave incorrecta' });
  }

  const log = [];
  const step = (msg) => { console.log(msg); log.push(msg); };

  try {
    step('🔄 Iniciando migración...');

    // TABLAS
    await db.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id            SERIAL PRIMARY KEY,
        login         VARCHAR(50)  UNIQUE NOT NULL,
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
      )
    `);
    step('✅ Tabla usuarios');

    await db.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id                 SERIAL PRIMARY KEY,
        codigo             VARCHAR(20) UNIQUE NOT NULL,
        fecha_creacion     DATE DEFAULT CURRENT_DATE,
        fecha_fin          DATE,
        fecha_comprometida DATE,
        fecha_cierre       TIMESTAMP,
        tipo_sol           VARCHAR(20)  DEFAULT 'Interno',
        nombre_sol         VARCHAR(200) NOT NULL,
        unidad_sol         VARCHAR(200),
        contacto_sol       VARCHAR(200),
        canal              VARCHAR(50),
        tipo_req           VARCHAR(100),
        descripcion        TEXT,
        prioridad          VARCHAR(20)  DEFAULT 'Media',
        estado             VARCHAR(30)  DEFAULT 'Abierto',
        responsable_id     INTEGER REFERENCES usuarios(id),
        fecha_asignacion   DATE,
        duracion           DECIMAL(6,2) DEFAULT 0,
        tiempo_optimo      DECIMAL(6,2) DEFAULT 0,
        comentario_interno TEXT,
        sla_cumplido       BOOLEAN DEFAULT TRUE,
        created_by         INTEGER REFERENCES usuarios(id),
        created_at         TIMESTAMP DEFAULT NOW()
      )
    `);
    step('✅ Tabla tickets');

    await db.query(`
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
      )
    `);
    step('✅ Tabla actividades');

    await db.query(`
      CREATE TABLE IF NOT EXISTS actividades_embajador (
        id                   SERIAL PRIMARY KEY,
        fecha                DATE NOT NULL,
        actividad            VARCHAR(255) NOT NULL,
        establecimiento      VARCHAR(255) NOT NULL,
        contacto             VARCHAR(150),
        cargo                VARCHAR(100),
        ciudad               VARCHAR(100),
        comuna               VARCHAR(100),
        horario              VARCHAR(100),
        horas                DECIMAL(5,2) DEFAULT 0,
        telefono             VARCHAR(50),
        correo               VARCHAR(150),
        lugar                VARCHAR(255),
        estado               VARCHAR(50)  DEFAULT 'Programada',
        comentario           TEXT,
        comentario_fecha     TIMESTAMP,
        traslado             VARCHAR(50),
        alimentacion         VARCHAR(50),
        num_estudiantes      INTEGER DEFAULT 0,
        cursos               VARCHAR(255),
        carreras             TEXT,
        observaciones_cierre TEXT,
        compromisos          TEXT,
        evaluacion           VARCHAR(50),
        cierre_por           VARCHAR(100),
        fecha_cierre         TIMESTAMP,
        created_by           INTEGER REFERENCES usuarios(id),
        created_at           TIMESTAMP DEFAULT NOW(),
        updated_at           TIMESTAMP DEFAULT NOW()
      )
    `);
    step('✅ Tabla actividades_embajador');

    await db.query(`
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
      )
    `);
    step('✅ Tabla asignaciones_embajador');

    await db.query(`
      CREATE TABLE IF NOT EXISTS disponibilidad (
        id                  SERIAL PRIMARY KEY,
        usuario_id          INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        dia                 INTEGER NOT NULL CHECK(dia BETWEEN 1 AND 7),
        hora_inicio         TIME NOT NULL,
        hora_fin            TIME NOT NULL,
        origen              VARCHAR(20) DEFAULT 'manual',
        fecha_actualizacion DATE DEFAULT CURRENT_DATE
      )
    `);
    step('✅ Tabla disponibilidad');

    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id          SERIAL PRIMARY KEY,
        usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        endpoint    TEXT UNIQUE NOT NULL,
        p256dh      TEXT,
        auth        TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);
    step('✅ Tabla push_subscriptions');

    await db.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id           SERIAL PRIMARY KEY,
        usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        titulo       VARCHAR(255) NOT NULL,
        cuerpo       TEXT,
        actividad_id INTEGER,
        leida        BOOLEAN DEFAULT FALSE,
        created_at   TIMESTAMP DEFAULT NOW()
      )
    `);
    step('✅ Tabla notificaciones');

    await db.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id             SERIAL PRIMARY KEY,
        usuario_id     INTEGER REFERENCES usuarios(id),
        accion         VARCHAR(50) NOT NULL,
        modulo         VARCHAR(100),
        campo          VARCHAR(100),
        valor_anterior TEXT,
        valor_nuevo    TEXT,
        created_at     TIMESTAMP DEFAULT NOW()
      )
    `);
    step('✅ Tabla auditoria');

    // INDICES
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_estado    ON tickets(estado);
      CREATE INDEX IF NOT EXISTS idx_actividades_fecha ON actividades(fecha);
      CREATE INDEX IF NOT EXISTS idx_act_emb_fecha     ON actividades_embajador(fecha);
      CREATE INDEX IF NOT EXISTS idx_asig_usuario      ON asignaciones_embajador(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_disp_usuario      ON disponibilidad(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_notif_usuario     ON notificaciones(usuario_id, leida);
    `);
    step('✅ Índices creados');

    // SEED — usuarios
    step('🌱 Insertando usuarios...');
    const usuarios = [
      { login:'admin',      pass:'Admin2024!',  nombre:'Administrador Sistema', rol:'Administrador', area:'Dirección',      carrera:'' },
      { login:'ti_user',    pass:'TI2024!',     nombre:'Carlos Muñoz',          rol:'Supervisor',    area:'Tecnología',     carrera:'' },
      { login:'consultor',  pass:'Consul2024!', nombre:'María González',         rol:'Consulta',      area:'Comunicaciones', carrera:'' },
      { login:'func1',      pass:'Func2024!',   nombre:'Andrea López',           rol:'Funcionario',   area:'Tecnología',     carrera:'' },
      { login:'embajador1', pass:'Emb2024!',    nombre:'Valentina Rojas',        rol:'Embajador',     area:'Promoción',      carrera:'Psicología' },
      { login:'embajador2', pass:'Emb2024!',    nombre:'Diego Fuentes',          rol:'Embajador',     area:'Promoción',      carrera:'Ingeniería Civil' },
    ];
    const ids = {};
    for (const u of usuarios) {
      const hash = await bcrypt.hash(u.pass, 12);
      const r = await db.query(
        `INSERT INTO usuarios(login,password_hash,nombre,rol,area,carrera,estado)
         VALUES($1,$2,$3,$4,$5,$6,'Activo')
         ON CONFLICT(login) DO UPDATE SET password_hash=$2,nombre=$3,rol=$4,area=$5,carrera=$6
         RETURNING id`,
        [u.login, hash, u.nombre, u.rol, u.area, u.carrera]
      );
      ids[u.login] = r.rows[0].id;
      step(`  ✓ ${u.login} (${u.rol})`);
    }

    // Ticket de prueba
    await db.query(`
      INSERT INTO tickets(codigo,tipo_sol,nombre_sol,unidad_sol,canal,tipo_req,
        descripcion,prioridad,estado,responsable_id,duracion,tiempo_optimo,sla_cumplido,created_by)
      VALUES('TCK-0001','Interno','Facultad de Ingeniería','Depto. TI','Correo',
        'Soporte Técnico','Falla en servidor de aplicaciones','Alta','En Proceso',
        $1,8,12,true,$2)
      ON CONFLICT(codigo) DO NOTHING`,
      [ids['ti_user'], ids['admin']]
    );
    step('✅ Ticket TCK-0001');

    // Actividad de prueba
    await db.query(`
      INSERT INTO actividades(titulo,descripcion,area,tipo,responsable,fecha,
        hora_inicio,hora_fin,duracion,prioridad,estado,tipo_sol,nombre_sol,
        unidad_sol,objetivo,created_by,modified_by)
      VALUES('Mantención servidor web','Actualización de certificados SSL',
        'Tecnología','Mantenimiento','Carlos Muñoz','2025-01-15',
        '08:00','10:30',2.5,'Alta','Completada','Interno','Depto. TI',
        'Tecnología','Aplicar parches de seguridad',$1,$1)`,
      [ids['admin']]
    );
    step('✅ Actividad institucional');

    // Actividad embajador
    const ae = await db.query(`
      INSERT INTO actividades_embajador(fecha,actividad,establecimiento,contacto,cargo,
        ciudad,comuna,horario,horas,telefono,correo,lugar,estado,created_by)
      VALUES('2025-01-20','Feria Vocacional Regional','Colegio San Ignacio',
        'María Pérez','Orientadora','Santiago','Providencia','10:00 - 13:00',
        3,'+56912345678','mperez@sanignacio.cl','Gimnasio Principal','Confirmada',$1)
      RETURNING id`,
      [ids['admin']]
    );
    const aeid = ae.rows[0].id;
    for (const login of ['embajador1','embajador2']) {
      await db.query(`
        INSERT INTO asignaciones_embajador(actividad_id,usuario_id,disp_estado,asignado_por)
        VALUES($1,$2,'disponible',$3) ON CONFLICT DO NOTHING`,
        [aeid, ids[login], ids['admin']]
      );
    }
    step('✅ Actividad embajador');

    // Disponibilidad
    for (const dia of [1,3,5]) {
      await db.query(
        `INSERT INTO disponibilidad(usuario_id,dia,hora_inicio,hora_fin,origen)
         VALUES($1,$2,'08:00','13:00','confirmada')`,
        [ids['embajador1'], dia]
      );
    }
    for (const dia of [2,4]) {
      await db.query(
        `INSERT INTO disponibilidad(usuario_id,dia,hora_inicio,hora_fin,origen)
         VALUES($1,$2,'14:00','19:00','manual')`,
        [ids['embajador2'], dia]
      );
    }
    step('✅ Disponibilidad embajadores');

    step('\n🎉 Setup completado exitosamente');
    res.json({ ok: true, log });

  } catch(e) {
    step(`❌ ERROR: ${e.message}`);
    res.status(500).json({ ok: false, error: e.message, log });
  }
});

module.exports = router;
