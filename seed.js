require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('../config/database');

async function seed() {
  console.log('🌱 Cargando datos iniciales...\n');
  const R = 12;

  const users = [
    { login:'admin',      pass:'Admin2024!',  nombre:'Administrador Sistema', rol:'Administrador', area:'Dirección',      carrera:'' },
    { login:'ti_user',    pass:'TI2024!',     nombre:'Carlos Muñoz',          rol:'Supervisor',    area:'Tecnología',     carrera:'' },
    { login:'consultor',  pass:'Consul2024!', nombre:'María González',         rol:'Consulta',      area:'Comunicaciones', carrera:'' },
    { login:'func1',      pass:'Func2024!',   nombre:'Andrea López',           rol:'Funcionario',   area:'Tecnología',     carrera:'' },
    { login:'embajador1', pass:'Emb2024!',    nombre:'Valentina Rojas',        rol:'Embajador',     area:'Promoción',      carrera:'Psicología' },
    { login:'embajador2', pass:'Emb2024!',    nombre:'Diego Fuentes',          rol:'Embajador',     area:'Promoción',      carrera:'Ingeniería Civil' },
  ];

  const ids = {};
  for (const u of users) {
    const hash = await bcrypt.hash(u.pass, R);
    const r = await db.query(
      `INSERT INTO usuarios(login,password_hash,nombre,rol,area,carrera,estado)
       VALUES($1,$2,$3,$4,$5,$6,'Activo')
       ON CONFLICT(login) DO UPDATE SET password_hash=$2,nombre=$3,rol=$4,area=$5,carrera=$6
       RETURNING id,login`,
      [u.login, hash, u.nombre, u.rol, u.area, u.carrera]);
    ids[u.login] = r.rows[0].id;
    console.log(`  ✓ ${u.login} (${u.rol})`);
  }

  // Ticket
  await db.query(
    `INSERT INTO tickets(codigo,tipo_sol,nombre_sol,unidad_sol,canal,tipo_req,descripcion,prioridad,estado,responsable_id,duracion,tiempo_optimo,sla_cumplido,created_by)
     VALUES('TCK-0001','Interno','Facultad de Ingeniería','Depto. TI','Correo','Soporte Técnico','Falla en servidor de aplicaciones','Alta','En Proceso',$1,8,12,true,$2)
     ON CONFLICT(codigo) DO NOTHING`,
    [ids['ti_user'], ids['admin']]);
  console.log('\n  ✓ Ticket TCK-0001');

  // Actividad
  await db.query(
    `INSERT INTO actividades(titulo,descripcion,area,tipo,responsable,fecha,hora_inicio,hora_fin,duracion,prioridad,estado,tipo_sol,nombre_sol,unidad_sol,objetivo,created_by)
     VALUES('Mantención servidor web','Actualización de certificados SSL','Tecnología','Mantenimiento','Carlos Muñoz','2025-01-15','08:00','10:30',2.5,'Alta','Completada','Interno','Depto. TI','Tecnología','Aplicar parches de seguridad',$1)`,
    [ids['admin']]);
  console.log('  ✓ Actividad de ejemplo');

  // Actividad embajador
  const emb = await db.query(
    `INSERT INTO actividades_embajador(fecha,actividad,establecimiento,contacto,cargo,ciudad,comuna,horario,horas,telefono,correo,lugar,estado,created_by)
     VALUES('2025-01-20','Feria Vocacional Regional','Colegio San Ignacio','María Pérez','Orientadora','Santiago','Providencia','10:00 - 13:00',3,'+56912345678','mperez@sanignacio.cl','Gimnasio Principal','Confirmada',$1) RETURNING id`,
    [ids['admin']]);
  const aeid = emb.rows[0].id;
  for (const login of ['embajador1','embajador2']) {
    await db.query(
      `INSERT INTO asignaciones_embajador(actividad_id,usuario_id,disp_estado,asignado_por) VALUES($1,$2,'disponible',$3) ON CONFLICT DO NOTHING`,
      [aeid, ids[login], ids['admin']]);
  }
  console.log('  ✓ Actividad embajador');

  // Disponibilidad embajador1: Lun/Mié/Vie mañanas
  for (const dia of [1,3,5]) {
    await db.query(
      `INSERT INTO disponibilidad(usuario_id,dia,hora_inicio,hora_fin,origen) VALUES($1,$2,'08:00','13:00','confirmada')`,
      [ids['embajador1'], dia]);
  }
  console.log('  ✓ Disponibilidad embajador1');

  console.log('\n✅ Seed completado exitosamente\n');
  console.log('🔑 Credenciales:');
  console.log('  admin / Admin2024!');
  console.log('  ti_user / TI2024!');
  console.log('  embajador1 / Emb2024!');
  console.log('  embajador2 / Emb2024!');
  process.exit(0);
}

seed().catch(e => { console.error('❌', e.message); process.exit(1); });
