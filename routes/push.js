const router  = require('express').Router();
const webpush = require('web-push');
const db      = require('../config/database');
const { auth } = require('../middleware/auth');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@institucion.cl',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    await db.query(
      `INSERT INTO push_subscriptions(usuario_id,endpoint,p256dh,auth)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(endpoint) DO UPDATE SET usuario_id=$1, p256dh=$3, auth=$4`,
      [req.user.id, subscription.endpoint, subscription.keys?.p256dh, subscription.keys?.auth]
    );
    res.status(201).json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/unsubscribe', auth, async (req, res) => {
  await db.query('DELETE FROM push_subscriptions WHERE usuario_id=$1', [req.user.id]);
  res.json({ ok: true });
});

router.get('/notificaciones', auth, async (req, res) => {
  const r = await db.query(
    'SELECT * FROM notificaciones WHERE usuario_id=$1 ORDER BY created_at DESC LIMIT 30',
    [req.user.id]
  );
  res.json({ notificaciones: r.rows });
});

router.put('/notificaciones/:id/leer', auth, async (req, res) => {
  await db.query(
    'UPDATE notificaciones SET leida=true WHERE id=$1 AND usuario_id=$2',
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

module.exports = router;
