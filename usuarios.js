const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../config/database');
const { auth, role } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const r = await db.query('SELECT id,login,nombre,rol,area,carrera,correo,estado,ultimo_acceso FROM usuarios ORDER BY nombre ASC');
  res.json({ usuarios: r.rows });
});

router.post('/', auth, role('Administrador'), async (req, res) => {
  try {
    const { login, password, nombre, rol, area, carrera, correo, estado } = req.body;
    if (!login || !password || !nombre) return res.status(400).json({ error: 'login, password y nombre son obligatorios' });
    const hash = await bcrypt.hash(password, 12);
    const r = await db.query(
      `INSERT INTO usuarios(login,password_hash,nombre,rol,area,carrera,correo,estado)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,login,nombre,rol,area,carrera,correo,estado`,
      [login.toLowerCase(), hash, nombre, rol||'Funcionario', area||'', carrera||'', correo||'', estado||'Activo']
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
    let hash;
    if (password) hash = await bcrypt.hash(password, 12);
    const r = await db.query(
      `UPDATE usuarios SET nombre=$1,rol=$2,area=$3,carrera=$4,correo=$5,estado=$6
       ${hash ? ',password_hash=$7' : ''}
       WHERE id=${hash ? '$8' : '$7'} RETURNING id,login,nombre,rol,area,carrera,correo,estado`,
      hash ? [nombre,rol,area,carrera||'',correo||'',estado,hash,req.params.id]
           : [nombre,rol,area,carrera||'',correo||'',estado,req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json({ usuario: r.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, role('Administrador'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  await db.query('UPDATE usuarios SET estado=$1 WHERE id=$2', ['Inactivo', req.params.id]);
  res.json({ message: 'Usuario desactivado' });
});

module.exports = router;
