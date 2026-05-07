const router = require('express').Router();
const db     = require('../config/database');
const { auth } = require('../middleware/auth');

// GET todas las actividades (admin/supervisor)
router.get('/', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT ae.*,
        COALESCE(json_agg(
          json_build_object(
            'id', u.id, 'nombre', u.nombre,
            'respuesta', aep.respuesta,
            'dispEstado', aep.disp_estado,
            'asignacionManual', aep.asignacion_manual,
            'motivoManual', aep.motivo_manual,
            'dispConfirmada', aep.disp_confirmada
          )
        ) FILTER (WHERE u.id IS NOT NULL), '[]') as embajadores
      FROM actividades_embajador ae
      LEFT JOIN asignaciones_embajador aep ON aep.actividad_id = ae.id
      LEFT JOIN usuarios u ON u.id = aep.usuario_id
      GROUP BY ae.id
      ORDER BY ae.actividad ASC`);
    res.json({ actividades: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET mis actividades (embajador)
router.get('/mis-actividades', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT ae.*, aep.respuesta, aep.disp_estado, aep.asignacion_manual, aep.disp_confirmada
      FROM actividades_embajador ae
      JOIN asignaciones_embajador aep ON aep.actividad_id = ae.id AND aep.usuario_id = $1
      ORDER BY ae.fecha ASC`, [req.user.id]);
    res.json({ actividades: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear actividad
router.post('/', auth, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const f = req.body;
    if (!f.actividad || !f.establecimiento)
      return res.status(400).json({ error: 'Actividad y establecimiento son obligatorios' });

    const r = await client.query(`
      INSERT INTO actividades_embajador(
        fecha,actividad,establecimiento,contacto,cargo,ciudad,comuna,
        horario,horas,telefono,correo,lugar,estado,created_by
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [f.fecha, f.actividad, f.establecimiento, f.contacto||'', f.cargo||'',
       f.ciudad||'', f.comuna||'', f.horario||'', parseFloat(f.horas)||0,
       f.telefono||'', f.correo||'', f.lugar||'', f.estado||'Programada', req.user.id]
    );
    const act = r.rows[0];

    if (f.embajador_ids?.length) {
      for (const eid of f.embajador_ids) {
        const dispEst = f.disp_estados?.[eid] || 'conflicto';
        await client.query(`
          INSERT INTO asignaciones_embajador(actividad_id,usuario_id,disp_estado,asignacion_manual,motivo_manual,asignado_por)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [act.id, eid, dispEst, dispEst==='conflicto', f.motivo_manual||'', req.user.id]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ actividad: act });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// PUT actualizar actividad
router.put('/:id', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await db.query(`
      UPDATE actividades_embajador SET
        fecha=$1, actividad=$2, establecimiento=$3, contacto=$4, cargo=$5,
        ciudad=$6, comuna=$7, horario=$8, horas=$9, telefono=$10,
        correo=$11, lugar=$12, estado=$13, updated_at=NOW()
      WHERE id=$14 RETURNING *`,
      [f.fecha, f.actividad, f.establecimiento, f.contacto||'', f.cargo||'',
       f.ciudad||'', f.comuna||'', f.horario||'', parseFloat(f.horas)||0,
       f.telefono||'', f.correo||'', f.lugar||'', f.estado||'Programada', req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrada' });

    // Guardar cierre si estado = Realizada
    if (f.estado === 'Realizada' && f.cierre) {
      const c = f.cierre;
      await db.query(`
        UPDATE actividades_embajador SET
          traslado=$1, alimentacion=$2, num_estudiantes=$3, cursos=$4, carreras=$5,
          observaciones_cierre=$6, compromisos=$7, evaluacion=$8,
          cierre_por=$9, fecha_cierre=NOW()
        WHERE id=$10`,
        [c.traslado||'', c.alimentacion||'', parseInt(c.numEstudiantes)||0,
         c.cursos||'', c.carreras||'', c.observaciones||'',
         c.compromisos||'', c.evaluacion||'', req.user.login, req.params.id]
      );
    }

    // Actualizar asignaciones si se pasan
    if (f.embajador_ids?.length) {
      await db.query('DELETE FROM asignaciones_embajador WHERE actividad_id=$1', [req.params.id]);
      for (const eid of f.embajador_ids) {
        const dispEst = f.disp_estados?.[eid] || 'conflicto';
        await db.query(`
          INSERT INTO asignaciones_embajador(actividad_id,usuario_id,disp_estado,asignacion_manual,motivo_manual,asignado_por)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [req.params.id, eid, dispEst, dispEst==='conflicto', f.motivo_manual||'', req.user.id]
        );
      }
    }

    res.json({ actividad: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT respuesta del embajador (aceptar/rechazar)
router.put('/:id/respuesta', auth, async (req, res) => {
  try {
    const { respuesta } = req.body;
    if (!['aceptada','rechazada'].includes(respuesta))
      return res.status(400).json({ error: 'Respuesta debe ser aceptada o rechazada' });
    await db.query(
      'UPDATE asignaciones_embajador SET respuesta=$1, fecha_respuesta=NOW() WHERE actividad_id=$2 AND usuario_id=$3',
      [respuesta, req.params.id, req.user.id]
    );
    if (respuesta === 'aceptada') {
      await db.query(`UPDATE actividades_embajador SET estado='Confirmada'
        WHERE id=$1 AND estado IN('Programada','En coordinación')`, [req.params.id]);
    }
    res.json({ message: `Actividad ${respuesta} correctamente` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST comentario del embajador
router.post('/:id/comentario', auth, async (req, res) => {
  try {
    const { comentario } = req.body;
    const check = await db.query(
      `SELECT ae.estado FROM actividades_embajador ae
       JOIN asignaciones_embajador aep ON aep.actividad_id=ae.id
       WHERE ae.id=$1 AND aep.usuario_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Actividad no encontrada' });
    if (check.rows[0].estado !== 'Realizada')
      return res.status(400).json({ error: 'Solo se pueden comentar actividades con estado Realizada' });
    await db.query(
      'UPDATE actividades_embajador SET comentario=$1, comentario_fecha=NOW() WHERE id=$2',
      [comentario, req.params.id]
    );
    res.json({ message: 'Comentario guardado' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
