'use strict';

const crypto = require('node:crypto');

// Mirrored by sql/question-votes.sql for operators who prefer an explicit migration.
// No existing Waline table is altered, read for identity, or cleared.
const CREATE_VOTES = `CREATE TABLE IF NOT EXISTS wl_question_vote (
  question_id bigint NOT NULL CHECK (question_id > 0),
  voter_hash varchar(64) NOT NULL CHECK (voter_hash ~ '^[a-f0-9]{64}$'),
  vote smallint NOT NULL CHECK (vote IN (-1, 0, 1)),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (question_id, voter_hash)
)`;

const COUNTS = `SELECT
  COUNT(*) FILTER (WHERE vote=1)::integer AS likes,
  COUNT(*) FILTER (WHERE vote=-1)::integer AS dislikes,
  COALESCE(MAX(vote) FILTER (WHERE voter_hash=$2), 0)::integer AS my_vote
  FROM wl_question_vote WHERE question_id=$1`;

function createVoteStore(pool, secret) {
  let initialization;
  const voterHash = (voterId) => voterId ? crypto.createHmac('sha256', secret).update(`question-voter:v1:${voterId}`).digest('hex') : '';
  async function ensureTable() {
    if (!initialization) {
      initialization = (async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // Serialize catalog creation across independent function cold starts.
          await client.query('SELECT pg_advisory_xact_lock(236407, 2)');
          await client.query(CREATE_VOTES);
          await client.query('COMMIT');
        } catch (failure) {
          await client.query('ROLLBACK');
          throw failure;
        } finally { client.release(); }
      })().catch((failure) => { initialization = undefined; throw failure; });
    }
    await initialization;
  }
  async function counts(client, questionId, hashedVoter) {
    const { rows } = await client.query(COUNTS, [questionId, hashedVoter]);
    const row = rows[0];
    return { questionId, likes: Number(row.likes), dislikes: Number(row.dislikes), myVote: Number(row.my_vote) };
  }
  return {
    async readQuestionVote(questionId, voterId) {
      await ensureTable();
      return counts(pool, questionId, voterHash(voterId));
    },
    async writeQuestionVote(questionId, voterId, vote) {
      await ensureTable();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Lock before changing the row and before counting. Separate statements at
        // READ COMMITTED see the completed previous writer after a lock wait.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended('question-vote:' || $1::text, 0))", [questionId]);
        const hashedVoter = voterHash(voterId);
        // Keep a neutral row for undo; no record is permanently deleted.
        await client.query(`INSERT INTO wl_question_vote (question_id, voter_hash, vote) VALUES ($1, $2, $3)
          ON CONFLICT (question_id, voter_hash) DO UPDATE SET vote=EXCLUDED.vote, updated_at=clock_timestamp()`, [questionId, hashedVoter, vote]);
        const data = await counts(client, questionId, hashedVoter);
        await client.query('COMMIT');
        return data;
      } catch (failure) {
        await client.query('ROLLBACK');
        throw failure;
      } finally { client.release(); }
    },
    async questionRanking(sort, limit, questionIds) {
      await ensureTable();
      // Column names are fixed server constants, never interpolated request input.
      const primary = sort === 'dislikes' ? 'dislikes' : 'likes';
      const { rows } = await pool.query(`SELECT question_id, likes, dislikes FROM (
        SELECT question_id, COUNT(*) FILTER (WHERE vote=1)::integer AS likes,
          COUNT(*) FILTER (WHERE vote=-1)::integer AS dislikes
        FROM wl_question_vote WHERE question_id=ANY($1::bigint[]) GROUP BY question_id
      ) AS totals WHERE ${primary}>0 ORDER BY ${primary} DESC, question_id ASC LIMIT $2`, [questionIds, limit]);
      return rows.map((row) => ({ questionId: Number(row.question_id), likes: Number(row.likes), dislikes: Number(row.dislikes) }));
    },
  };
}

module.exports = { createVoteStore, CREATE_VOTES };
