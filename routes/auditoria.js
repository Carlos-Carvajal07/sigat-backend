const router = require('express').Router();
const db     = require('../config/database');
const { auth, role } = require('../middleware/auth');

router.get('/', auth, role('Administrador','Supervisor'), async (req, res) => {
  try {
    const r = await db.query(`
      SELECT a.*, u.login as usuario_login
      FROM auditoria a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ORDER BY a.created_at DESC
      LIMIT 200`);
    res.json({ auditoria: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
