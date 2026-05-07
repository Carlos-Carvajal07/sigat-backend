const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/database');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    const r = await db.query('SELECT * FROM usuarios WHERE login=$1', [username.toLowerCase().trim()]);
    const u = r.rows[0];
    if (!u || u.estado !== 'Activo')
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign({ userId: u.id, rol: u.rol }, process.env.JWT_SECRET, { expiresIn: '24h' });
    const refresh = jwt.sign({ userId: u.id, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '7d' });

    await db.query('UPDATE usuarios SET refresh_token=$1, ultimo_acceso=NOW() WHERE id=$2', [refresh, u.id]);

    res.json({
      token, refreshToken: refresh,
      user: { id: u.id, login: u.login, nombre: u.nombre, rol: u.rol, area: u.area, carrera: u.carrera, correo: u.correo }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Token requerido' });
    const d = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (d.type !== 'refresh') return res.status(401).json({ error: 'Token inválido' });
    const r = await db.query('SELECT * FROM usuarios WHERE id=$1 AND refresh_token=$2', [d.userId, refreshToken]);
    if (!r.rows.length) return res.status(401).json({ error: 'Token expirado' });
    const token = jwt.sign({ userId: r.rows[0].id, rol: r.rows[0].rol }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch(e) { res.status(401).json({ error: 'Token expirado, inicie sesión nuevamente' }); }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const h = req.headers.authorization;
    if (h) {
      const d = jwt.decode(h.split(' ')[1]);
      if (d?.userId) await db.query('UPDATE usuarios SET refresh_token=NULL WHERE id=$1', [d.userId]);
    }
  } catch {}
  res.json({ message: 'Sesión cerrada' });
});

module.exports = router;
