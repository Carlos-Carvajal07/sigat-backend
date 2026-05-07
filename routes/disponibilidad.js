const router = require('express').Router();
const db     = require('../config/database');
const { auth } = require('../middleware/auth');

const toMin = t => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+(m||0); };

// GET disponibilidad de un embajador
router.get('/:embId', auth, async (req, res) => {
  const r = await db.query(
    'SELECT * FROM disponibilidad WHERE usuario_id=$1 ORDER BY dia, hora_inicio',
    [req.params.embId]
  );
  res.json({ disponibilidad: r.rows });
});

// POST agregar bloque
router.post('/:embId', auth, async (req, res) => {
  try {
    const { dia, hora_inicio, hora_fin, origen } = req.body;
    if (!dia || !hora_inicio || !hora_fin)
      return res.status(400).json({ error: 'dia, hora_inicio y hora_fin son obligatorios' });
    if (toMin(hora_inicio) >= toMin(hora_fin))
      return res.status(400).json({ error: 'hora_inicio debe ser anterior a hora_fin' });
    const r = await db.query(
      `INSERT INTO disponibilidad(usuario_id,dia,hora_inicio,hora_fin,origen,fecha_actualizacion)
       VALUES($1,$2,$3,$4,$5,CURRENT_DATE) RETURNING *`,
      [req.params.embId, dia, hora_inicio, hora_fin, origen||'manual']
    );
    res.status(201).json({ bloque: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE eliminar bloque
router.delete('/:embId/:bloqueId', auth, async (req, res) => {
  await db.query('DELETE FROM disponibilidad WHERE id=$1 AND usuario_id=$2',
    [req.params.bloqueId, req.params.embId]);
  res.json({ message: 'Bloque eliminado' });
});

// GET verificar disponibilidad para una fecha y horario
router.get('/:embId/verificar', auth, async (req, res) => {
  try {
    const { fecha, hora_inicio, hora_fin } = req.query;
    const dow = new Date(fecha + 'T00:00:00').getDay();
    const dia = dow === 0 ? 7 : dow;
    const r = await db.query(
      'SELECT * FROM disponibilidad WHERE usuario_id=$1 AND dia=$2',
      [req.params.embId, dia]
    );
    const ini = toMin(hora_inicio), fin_ = toMin(hora_fin);
    let estado = 'conflicto';
    for (const b of r.rows) {
      const bIni = toMin(b.hora_inicio.substring(0,5));
      const bFin = toMin(b.hora_fin.substring(0,5));
      if (ini >= bIni && fin_ <= bFin) { estado = 'disponible'; break; }
      if (ini < bFin && fin_ > bIni)   estado = 'parcial';
    }
    res.json({ estado, bloques: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
