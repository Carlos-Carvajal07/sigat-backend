const router = require('express').Router();
const db     = require('../config/database');
const { auth } = require('../middleware/auth');

const calcSLA = (prioridad, horas) => {
  const m = { 'Crítica':4,'Urgente':8,'Alta':8,'Media':24,'Baja':48 };
  return parseFloat(horas||0) <= (m[prioridad]||24);
};
const audit = (db, uid, accion, campo, ant, nvo) =>
  db.query('INSERT INTO auditoria(usuario_id,accion,modulo,campo,valor_anterior,valor_nuevo) VALUES($1,$2,$3,$4,$5,$6)',
    [uid, accion, 'Ticket', campo, ant, nvo]).catch(()=>{});

const getNextCode = async () => {
  const r = await db.query("SELECT codigo FROM tickets ORDER BY id DESC LIMIT 1");
  const last = r.rows[0]?.codigo || 'TCK-0000';
  return 'TCK-' + String(parseInt(last.split('-')[1]) + 1).padStart(4,'0');
};

// GET /api/tickets
router.get('/', auth, async (req, res) => {
  try {
    const { estado, prioridad, desde, hasta } = req.query;
    let q = `SELECT t.*, u.nombre as responsable_nombre
             FROM tickets t LEFT JOIN usuarios u ON u.id=t.responsable_id
             WHERE 1=1`;
    const p = [];
    if (estado)    { p.push(estado);    q += ` AND t.estado=$${p.length}`; }
    if (prioridad) { p.push(prioridad); q += ` AND t.prioridad=$${p.length}`; }
    if (desde)     { p.push(desde);     q += ` AND t.fecha_creacion>=$${p.length}`; }
    if (hasta)     { p.push(hasta);     q += ` AND t.fecha_creacion<=$${p.length}`; }
    q += ` ORDER BY CASE t.estado WHEN 'En Proceso' THEN 1 WHEN 'Abierto' THEN 2 WHEN 'Resuelto' THEN 3 ELSE 4 END, t.id DESC`;
    const r = await db.query(q, p);
    res.json({ tickets: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tickets/:id
router.get('/:id', auth, async (req, res) => {
  const r = await db.query('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
  res.json(r.rows[0]);
});

// POST /api/tickets
router.post('/', auth, async (req, res) => {
  try {
    const { tipo_sol,nombre_sol,unidad_sol,contacto_sol,canal,tipo_req,descripcion,
            prioridad,estado,responsable_id,fecha_fin,fecha_comprometida,
            duracion,tiempo_optimo,comentario_interno } = req.body;
    if (!nombre_sol || !descripcion)
      return res.status(400).json({ error: 'Solicitante y descripción son obligatorios' });
    const codigo = await getNextCode();
    const sla = calcSLA(prioridad, duracion);
    const r = await db.query(`
      INSERT INTO tickets(codigo,tipo_sol,nombre_sol,unidad_sol,contacto_sol,canal,
        tipo_req,descripcion,prioridad,estado,responsable_id,fecha_fin,fecha_comprometida,
        duracion,tiempo_optimo,comentario_interno,sla_cumplido,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [codigo, tipo_sol||'Interno', nombre_sol, unidad_sol||'', contacto_sol||'',
       canal||'Correo', tipo_req||'Soporte Técnico', descripcion,
       prioridad||'Media', estado||'Abierto', responsable_id||null,
       fecha_fin||null, fecha_comprometida||null,
       parseFloat(duracion)||0, parseFloat(tiempo_optimo)||0,
       comentario_interno||'', sla, req.user.id]
    );
    await audit(db, req.user.id, 'CREAR', codigo, '', estado||'Abierto');
    res.status(201).json({ ticket: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/tickets/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const old = await db.query('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ error: 'No encontrado' });
    const t = old.rows[0];
    const { tipo_sol,nombre_sol,unidad_sol,contacto_sol,canal,tipo_req,descripcion,
            prioridad,estado,responsable_id,fecha_fin,fecha_comprometida,
            duracion,tiempo_optimo,comentario_interno } = req.body;
    const newEstado = estado || t.estado;
    const newPrio   = prioridad || t.prioridad;
    const newDur    = parseFloat(duracion ?? t.duracion);
    const sla = calcSLA(newPrio, newDur);
    const r = await db.query(`
      UPDATE tickets SET
        tipo_sol=$1, nombre_sol=$2, unidad_sol=$3, contacto_sol=$4, canal=$5,
        tipo_req=$6, descripcion=$7, prioridad=$8, estado=$9, responsable_id=$10,
        fecha_fin=$11, fecha_comprometida=$12, duracion=$13, tiempo_optimo=$14,
        comentario_interno=$15, sla_cumplido=$16,
        fecha_cierre=CASE WHEN $9 IN('Cerrado','Resuelto') THEN NOW() ELSE fecha_cierre END
      WHERE id=$17 RETURNING *`,
      [tipo_sol||t.tipo_sol, nombre_sol||t.nombre_sol, unidad_sol??t.unidad_sol,
       contacto_sol??t.contacto_sol, canal||t.canal, tipo_req||t.tipo_req,
       descripcion||t.descripcion, newPrio, newEstado,
       responsable_id ?? t.responsable_id,
       fecha_fin||t.fecha_fin, fecha_comprometida||t.fecha_comprometida,
       newDur, parseFloat(tiempo_optimo ?? t.tiempo_optimo),
       comentario_interno ?? t.comentario_interno, sla, req.params.id]
    );
    if (t.estado !== newEstado) await audit(db, req.user.id, 'EDITAR', t.codigo, t.estado, newEstado);
    res.json({ ticket: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/tickets/:id
router.delete('/:id', auth, async (req, res) => {
  const r = await db.query('DELETE FROM tickets WHERE id=$1 RETURNING codigo', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
  await audit(db, req.user.id, 'ELIMINAR', r.rows[0].codigo, '', '');
  res.json({ message: 'Ticket eliminado' });
});

module.exports = router;
