'use strict';

const crypto = require('node:crypto');
const { Pool } = require('pg');

function createStore(env) {
  for (const name of ['PG_HOST', 'PG_DB', 'PG_USER', 'PG_PASSWORD', 'JWT_TOKEN']) {
    if (!env[name]) throw new Error(`Missing required environment field: ${name}`);
  }
  if (env.JWT_TOKEN.length < 32) throw new Error('JWT_TOKEN must contain at least 32 random characters');
  if (env.PG_SSL !== 'true') throw new Error('PG_SSL=true is required for Neon');
  if (env.PG_PREFIX && env.PG_PREFIX !== 'wl_') throw new Error('This deployment uses the official wl_ schema');
  const pool = new Pool({
    host: env.PG_HOST, database: env.PG_DB, user: env.PG_USER,
    password: env.PG_PASSWORD, port: Number(env.PG_PORT || 5432),
    max: 2, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true },
  });
  return {
    async emptyUsers() {
      const { rows } = await pool.query('SELECT NOT EXISTS (SELECT 1 FROM wl_users) AS empty');
      return rows[0].empty === true;
    },
    async withFirstUser(action) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // A transaction-scoped PostgreSQL advisory lock serializes all serverless
        // bootstrap requests, including different cold-start instances.
        await client.query('SELECT pg_advisory_xact_lock(236407, 1)');
        const { rows } = await client.query('SELECT NOT EXISTS (SELECT 1 FROM wl_users) AS empty');
        if (!rows[0].empty) { await client.query('ROLLBACK'); return null; }
        const response = await action();
        await client.query('COMMIT');
        return response;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    async approvedParent(id, url) {
      const { rows } = await pool.query('SELECT id, rid FROM wl_comment WHERE id=$1 AND url=$2 AND status=$3', [id, url, 'approved']);
      return rows[0] || null;
    },
    async rateLimit(subject, seconds) {
      // Only an HMAC of the IP is stored in the extra limiter table. UPSERT is
      // atomic across concurrent Netlify function instances.
      const key = crypto.createHmac('sha256', env.JWT_TOKEN).update(subject).digest('hex');
      const result = await pool.query(`
        INSERT INTO wl_request_limit (key, last_at) VALUES ($1, clock_timestamp())
        ON CONFLICT (key) DO UPDATE SET last_at=EXCLUDED.last_at
        WHERE wl_request_limit.last_at <= EXCLUDED.last_at - ($2 * interval '1 second')
        RETURNING key`, [key, seconds]);
      // Entries are small; periodically reclaim those older than a day.
      if (crypto.randomInt(100) === 0) await pool.query("DELETE FROM wl_request_limit WHERE last_at < now() - interval '1 day'");
      return result.rowCount === 1;
    },
    close: () => pool.end(),
  };
}

module.exports = { createStore };
