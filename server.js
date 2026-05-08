require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'https://sigat-plus.onrender.com',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'null'
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 300 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 20 }));

app.use('/api/auth',           require('./routes/auth'));
app.use('/api/setup',          require('./routes/setup'));
app.use('/api/usuarios',       require('./routes/usuarios'));
app.use('/api/tickets',        require('./routes/tickets'));
app.use('/api/actividades',    require('./routes/actividades'));
app.use('/api/embajadores',    require('./routes/embajadores'));
app.use('/api/disponibilidad', require('./routes/disponibilidad'));
app.use('/api/push',           require('./routes/push'));
app.use('/api/auditoria',      require('./routes/auditoria'));

app.get('/api/vapid/public-key', (req, res) =>
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' }));

app.get('/health', async (req, res) => {
  try {
    await require('./config/database').query('SELECT 1');
    res.json({ status: 'ok', service: 'SIGAT+ API v4', db: 'connected', uptime: Math.floor(process.uptime()) + 's' });
  } catch(e) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: e.message });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Error interno' : err.message });
});

const PORT = process.env.PORT || 3000;
async function start() {
  try {
    await require('./config/database').query('SELECT 1');
    console.log('✅ Base de datos conectada');
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 SIGAT+ API corriendo en puerto ${PORT}`));
  } catch(e) {
    console.error('❌ Error BD:', e.message);
    process.exit(1);
  }
}
start();
