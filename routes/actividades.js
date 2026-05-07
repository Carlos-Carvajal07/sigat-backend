const router = require('express').Router();
const db     = require('../config/database');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { area, tipo, estado, desde, hasta, responsable, unidad } = req.query;
    let q = 'SELECT * FROM actividades WHERE 1=1';
    const p = [];
    if (area)        { p.push(area);                      q += ` AND area=$${p.length}`; }
    if (tipo)        { p.push(tipo);                      q += ` AND tipo=$${p.length}`; }
    if (estado)      { p.push(estado);                    q += ` AND estado=$${p.length}`; }
    if (desde)       { p.push(desde);                     q += ` AND fecha>=$${p.length}`; }
    if (hasta)       { p.push(hasta);                     q += ` AND fecha<=$${p.length}`; }
    if (responsable) { p.push(responsable);               q += ` AND responsable=$${p.length}`; }
    if (unidad)      { p.push('%'+unidad.toLowerCase()+'%'); q += ` AND LOWER(unidad_sol) LIKE $${p.length}`; }
    q += ' ORDER BY titulo ASC';
    const r = await db.query(q, p);
    res.json({ actividades: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  const r = await db.query('SELECT * FROM actividades WHERE id=$1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'No encontrada' });
  res.json(r.rows[0]);
});

router.post('/', auth, async (req, res) => {
  try {
    const f = req.body;
    if (!f.titulo || !f.nombre_sol)
      return res.status(400).json({ error: 'Título y solicitante son obligatorios' });
    const r = await db.query(`
      INSERT INTO actividades(
        titulo,descripcion,area,tipo,subtipo,responsable,fecha,hora_inicio,hora_fin,
        duracion,prioridad,estado,tipo_sol,nombre_sol,unidad_sol,contacto_sol,desc_sol,
        ticket_id,meta,observaciones,objetivo,unidad_participante,acuerdos,
        responsables_comp,fecha_seguimiento,estado_cumplimiento,links,created_by,modified_by
      ) VALUES(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$28
      ) RETURNING *`,
      [f.titulo, f.descripcion||'', f.area||'Tecnología', f.tipo||'Otro', f.subtipo||'',
       f.responsable||'', f.fecha, f.hora_inicio||'', f.hora_fin||'',
       parseFloat(f.duracion)||0, f.prioridad||'Media', f.estado||'Pendiente',
       f.tipo_sol||'Interno', f.nombre_sol, f.unidad_sol||'', f.contacto_sol||'',
       f.desc_sol||'', f.ticket_id||null, f.meta||'', f.observaciones||'',
       f.objetivo||'', f.unidad_participante||'', f.acuerdos||'',
       f.responsables_comp||'', f.fecha_seguimiento||null,
       f.estado_cumplimiento||'', f.links||'', req.user.id]
    );
    await db.query(
      'INSERT INTO auditoria(usuario_id,accion,modulo,campo,valor_nuevo) VALUES($1,$2,$3,$4,$5)',
      [req.user.id, 'CREAR', 'Actividad', f.titulo, f.estado||'Pendiente']
    ).catch(()=>{});
    res.status(201).json({ actividad: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const old = await db.query('SELECT estado FROM actividades WHERE id=$1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ error: 'No encontrada' });
    const f = req.body;
    const r = await db.query(`
      UPDATE actividades SET
        titulo=$1, descripcion=$2, area=$3, tipo=$4, subtipo=$5, responsable=$6,
        fecha=$7, hora_inicio=$8, hora_fin=$9, duracion=$10, prioridad=$11, estado=$12,
        tipo_sol=$13, nombre_sol=$14, unidad_sol=$15, contacto_sol=$16, desc_sol=$17,
        ticket_id=$18, meta=$19, observaciones=$20, objetivo=$21,
        unidad_participante=$22, acuerdos=$23, responsables_comp=$24,
        fecha_seguimiento=$25, estado_cumplimiento=$26, links=$27,
        modified_by=$28, updated_at=NOW()
      WHERE id=$29 RETURNING *`,
      [f.titulo, f.descripcion||'', f.area, f.tipo, f.subtipo||'', f.responsable,
       f.fecha, f.hora_inicio||'', f.hora_fin||'', parseFloat(f.duracion)||0,
       f.prioridad, f.estado, f.tipo_sol, f.nombre_sol, f.unidad_sol||'',
       f.contacto_sol||'', f.desc_sol||'', f.ticket_id||null, f.meta||'',
       f.observaciones||'', f.objetivo||'', f.unidad_participante||'',
       f.acuerdos||'', f.responsables_comp||'', f.fecha_seguimiento||null,
       f.estado_cumplimiento||'', f.links||'', req.user.id, req.params.id]
    );
    if (old.rows[0].estado !== f.estado) {
      await db.query(
        'INSERT INTO auditoria(usuario_id,accion,modulo,campo,valor_anterior,valor_nuevo) VALUES($1,$2,$3,$4,$5,$6)',
        [req.user.id, 'EDITAR', 'Actividad', f.titulo, old.rows[0].estado, f.estado]
      ).catch(()=>{});
    }
    res.json({ actividad: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
