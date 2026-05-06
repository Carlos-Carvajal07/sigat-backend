const router = require('express').Router();
const db     = require('../config/database');
const { auth } = require('../middleware/auth');

router.get('/:embId', auth, async (req, res) => {
  const r = await db.query(
    'SELECT * FROM disponibilidad WHERE usuario_id=$1 ORDER BY dia,hora_inicio',
    [req.params.embId]);
  res.json({ disponibilidad: r.rows });
});

router.post('/:embId', auth, async (req, res) => {
  const { dia, hora_inicio, hora_fin, origen } = req.body;
  const r = await db.query(
    `INSERT INTO disponibilidad(usuario_id,dia,hora_inicio,hora_fin,origen,fecha_actualizacion)
     VALUES($1,$2,$3,$4,$5,NOW()) RETURNING *`,
    [req.params.embId, dia, hora_inicio, hora_fin, origen||'manual']);
  res.status(201).json({ bloque: r.rows[0] });
});

router.delete('/:embId/:bloqueId', auth, async (req, res) => {
  await db.query('DELETE FROM disponibilidad WHERE id=$1 AND usuario_id=$2',
    [req.params.bloqueId, req.params.embId]);
  res.json({ message: 'Bloque eliminado' });
});

router.get('/:embId/verificar', auth, async (req, res) => {
  const { fecha, hora_inicio, hora_fin } = req.query;
  const dow = new Date(fecha+'T00:00:00').getDay();
  const dia = dow === 0 ? 7 : dow;
  const r = await db.query(
    'SELECT * FROM disponibilidad WHERE usuario_id=$1 AND dia=$2',
    [req.params.embId, dia]);
  const ini = toMin(hora_inicio), fin_ = toMin(hora_fin);
  let estado = 'conflicto';
  for (const b of r.rows) {
    const bIni = toMin(b.hora_inicio), bFin = toMin(b.hora_fin);
    if (ini >= bIni && fin_ <= bFin) { estado = 'disponible'; break; }
    if (ini < bFin && fin_ > bIni)   { estado = 'parcial'; }
  }
  res.json({ estado, bloques: r.rows });
});

const toMin = t => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+(m||0); };
module.exports = router;
