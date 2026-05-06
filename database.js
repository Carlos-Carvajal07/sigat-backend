const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
});
pool.on('error', err => console.error('Pool error:', err.message));
module.exports = { query: (t, p) => pool.query(t, p), getClient: () => pool.connect(), pool };
