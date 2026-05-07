const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../config/database');
const { auth, role } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const r = await db.query(
    'SELECT id,login,nombre,rol,area,carrera,correo,estado,ultimo_acceso FROM usuarios ORDER BY nombre ASC'
  );
  res.json({ usuarios: r.rows });
});

router.post('/', auth, role('Administrador'), async (req, res) => {
  try {
    const { login, password, nombre, rol, area, carrera, correo, estado } = req.body;
    if (!login || !password || !nombre)
      return res.status(400).json({ error: 'login, password y nombre son obligatorios' });
    const hash = await bcrypt.hash(password, 12);
    const r = await db.query(
      `INSERT INTO usuarios(login,password_hash,nombre,rol,area,carrera,correo,estado)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,login,nombre,rol,area,carrera,correo,estado`,
      [login.toLowerCase().trim(), hash, nombre, rol||'Funcionario', area||'', carrera||'', correo||'', estado||'Activo']
    );
    res.status(201).json({ usuario: r.rows[0] });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'El login ya existe' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, role('Administrador'), async (req, res) => {
  try {
    const { nombre, rol, area, carrera, correo, estado, password } = req.body;
    let query, params;
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      query = `UPDATE usuarios SET nombre=$1,rol=$2,area=$3,carrera=$4,correo=$5,estado=$6,password_hash=$7
               WHERE id=$8 RETURNING id,login,nombre,rol,area,carrera,correo,estado`;
      params = [nombre, rol, area, carrera||'', correo||'', estado, hash, req.params.id];
    } else {
      query = `UPDATE usuarios SET nombre=$1,rol=$2,area=$3,carrera=$4,correo=$5,estado=$6
               WHERE id=$7 RETURNING id,login,nombre,rol,area,carrera,correo,estado`;
      params = [nombre, rol, area, carrera||'', correo||'', estado, req.params.id];
    }
    const r = await db.query(query, params);
    if (!r.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ usuario: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, role('Administrador'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
  await db.query("UPDATE usuarios SET estado='Inactivo' WHERE id=$1", [req.params.id]);
  res.json({ message: 'Usuario desactivado' });
});

module.exports = router;
