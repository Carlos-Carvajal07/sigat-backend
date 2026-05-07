const jwt = require('jsonwebtoken');
const db  = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer '))
      return res.status(401).json({ error: 'Token requerido' });
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    const r = await db.query(
      'SELECT id,login,nombre,rol,area FROM usuarios WHERE id=$1 AND estado=$2',
      [decoded.userId, 'Activo']
    );
    if (!r.rows.length) return res.status(401).json({ error: 'Usuario inactivo' });
    req.user = r.rows[0];
    next();
  } catch(e) {
    if (e.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const role = (...roles) => (req, res, next) =>
  roles.includes(req.user?.rol)
    ? next()
    : res.status(403).json({ error: 'Sin permiso para esta acción' });

module.exports = { auth, role };
