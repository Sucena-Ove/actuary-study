'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createVoteStore, CREATE_VOTES } = require('../lib/vote-store.cjs');
const secret = 'TEST_ONLY_STORE_SECRET_DO_NOT_DEPLOY_123456';
const voter = 'b2'.repeat(32);

// A transaction-aware PG boundary fixture: real production SQL is captured,
// commits publish staged writes and advisory locks actually serialize promises.
// This does not connect to Neon or claim to test PostgreSQL's own implementation.
function database() {
  const rows = new Map(), statements = [], locks = new Map();
  let sequence = 0, failCreate = false, failWrite = false;
  const pool = {
    statements, rows,
    set failCreate(value) { failCreate = value; },
    set failWrite(value) { failWrite = value; },
    async connect() {
      const id = ++sequence, staged = new Map(), releases = [];
      return {
        async query(sql, params = []) {
          statements.push({ id, sql, params });
          if (sql.includes('pg_advisory_xact_lock')) {
            const key = params.length ? `question:${params[0]}` : 'schema';
            const previous = locks.get(key) || Promise.resolve();
            let release;
            const mine = new Promise((resolve) => { release = resolve; });
            locks.set(key, previous.then(() => mine));
            await previous;
            releases.push(release);
          } else if (sql === CREATE_VOTES && failCreate) throw new Error('fixture create failed');
          else if (sql.startsWith('INSERT INTO wl_question_vote')) {
            if (failWrite) throw new Error('fixture write failed');
            staged.set(`${params[0]}:${params[1]}`, { question_id: params[0], voter_hash: params[1], vote: params[2] });
          } else if (sql.startsWith('DELETE FROM wl_question_vote')) staged.set(`${params[0]}:${params[1]}`, null);
          else if (sql.includes('AS my_vote')) return counts(new Map([...rows, ...staged]), params);
          else if (sql === 'COMMIT' || sql === 'ROLLBACK') {
            if (sql === 'COMMIT') for (const [key, row] of staged) row ? rows.set(key, row) : rows.delete(key);
            staged.clear();
            for (const release of releases.splice(0)) release();
          }
          return { rows: [] };
        },
        release() { statements.push({ id, sql: 'RELEASE', params: [] }); },
      };
    },
    async query(sql, params) {
      statements.push({ id: 0, sql, params });
      if (sql.includes('AS my_vote')) return counts(rows, params);
      assert.match(sql, /WHERE question_id=ANY\(\$1::bigint\[\]\)/);
      assert.match(sql, /ORDER BY (likes|dislikes) DESC, question_id ASC LIMIT \$2/);
      const totals = new Map();
      for (const row of rows.values()) if (params[0].includes(row.question_id)) {
        const aggregate = totals.get(row.question_id) || { question_id: row.question_id, likes: 0, dislikes: 0 };
        if (row.vote === 1) aggregate.likes++;
        if (row.vote === -1) aggregate.dislikes++;
        totals.set(row.question_id, aggregate);
      }
      const sort = sql.includes('ORDER BY dislikes') ? 'dislikes' : 'likes';
      return { rows: [...totals.values()].filter((row) => row[sort] > 0).sort((a, b) => b[sort] - a[sort] || a.question_id - b.question_id).slice(0, params[1]) };
    },
  };
  function counts(all, [questionId, hash]) {
    const matching = [...all.values()].filter((row) => row?.question_id === questionId);
    return { rows: [{ likes: matching.filter((row) => row.vote === 1).length, dislikes: matching.filter((row) => row.vote === -1).length, my_vote: matching.find((row) => row.voter_hash === hash)?.vote || 0 }] };
  }
  return pool;
}

test('store persists only HMAC device IDs and atomically replaces or withdraws a vote', async () => {
  const pool = database(), store = createVoteStore(pool, secret);
  assert.deepEqual(await store.readQuestionVote(587, voter), { questionId: 587, likes: 0, dislikes: 0, myVote: 0 });
  assert.deepEqual(await store.writeQuestionVote(587, voter, 1), { questionId: 587, likes: 1, dislikes: 0, myVote: 1 });
  assert.deepEqual(await store.writeQuestionVote(587, voter, 1), { questionId: 587, likes: 1, dislikes: 0, myVote: 1 });
  assert.deepEqual(await store.writeQuestionVote(587, voter, -1), { questionId: 587, likes: 0, dislikes: 1, myVote: -1 });
  assert.equal(pool.rows.size, 1);
  const persisted = [...pool.rows.values()][0];
  assert.match(persisted.voter_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(persisted.voter_hash, voter);
  assert.doesNotMatch(JSON.stringify(pool.statements), new RegExp(voter + '|' + secret));
  assert.deepEqual(await store.writeQuestionVote(587, voter, 0), { questionId: 587, likes: 0, dislikes: 0, myVote: 0 });
  assert.deepEqual(await store.writeQuestionVote(587, voter, 0), { questionId: 587, likes: 0, dislikes: 0, myVote: 0 });
  assert.equal(pool.rows.size, 1);
  assert.equal([...pool.rows.values()][0].vote, 0);
  assert.equal(pool.statements.filter(({ sql }) => sql === CREATE_VOTES).length, 1);
});

test('concurrent requests and independent serverless instances serialize per question before counting', async () => {
  const pool = database(), first = createVoteStore(pool, secret), second = createVoteStore(pool, secret);
  const results = await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second).writeQuestionVote(587, `${index}`.padStart(64, '0'), 1)));
  assert.deepEqual(results.map((row) => row.likes).sort((a, b) => a - b), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.equal((await first.readQuestionVote(587, '')).likes, 12);
  assert.equal(pool.rows.size, 12);
  for (const id of new Set(pool.statements.filter(({ sql }) => sql.startsWith('INSERT INTO')).map(({ id }) => id))) {
    const statements = pool.statements.filter((item) => item.id === id).map(({ sql }) => sql);
    assert.equal(statements[0], 'BEGIN');
    assert.match(statements[1], /pg_advisory_xact_lock/);
    assert.match(statements[2], /ON CONFLICT \(question_id, voter_hash\) DO UPDATE/);
    assert.match(statements[3], /AS my_vote/);
    assert.deepEqual(statements.slice(-2), ['COMMIT', 'RELEASE']);
  }
});

test('failed initialization retries without caching rejection, failed writes roll back and release', async () => {
  const pool = database(), store = createVoteStore(pool, secret);
  pool.failCreate = true;
  await assert.rejects(store.readQuestionVote(1, voter));
  assert.equal(pool.statements.at(-2).sql, 'ROLLBACK');
  assert.equal(pool.statements.at(-1).sql, 'RELEASE');
  pool.failCreate = false;
  assert.equal((await store.readQuestionVote(1, voter)).likes, 0);
  pool.failWrite = true;
  await assert.rejects(store.writeQuestionVote(1, voter, 1));
  assert.equal(pool.rows.size, 0);
  assert.equal(pool.statements.at(-2).sql, 'ROLLBACK');
  assert.equal(pool.statements.at(-1).sql, 'RELEASE');
  pool.failWrite = false;
  assert.equal((await store.writeQuestionVote(1, voter, 1)).likes, 1);
});

test('rankings use current manifest, deterministic ties, positive counts and bound limit', async () => {
  const pool = database(), store = createVoteStore(pool, secret);
  await store.writeQuestionVote(587, voter, 1);
  await store.writeQuestionVote(1, voter, 1);
  await store.writeQuestionVote(1, 'd4'.repeat(32), -1);
  await store.writeQuestionVote(587, 'e5'.repeat(32), 0); // An undo must never become a downvote.
  await store.writeQuestionVote(999, voter, 1); // Retired question, filtered by current manifest.
  assert.deepEqual(await store.questionRanking('likes', 20, [1, 587]), [{ questionId: 1, likes: 1, dislikes: 1 }, { questionId: 587, likes: 1, dislikes: 0 }]);
  assert.deepEqual(await store.questionRanking('dislikes', 1, [1, 587]), [{ questionId: 1, likes: 1, dislikes: 1 }]);
});

test('operator migration and lazy schema agree without touching old Waline tables', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../sql/question-votes.sql'), 'utf8');
  assert.ok(migration.includes(CREATE_VOTES + ';'));
  assert.doesNotMatch(migration, /\b(DROP|ALTER|DELETE|TRUNCATE)\b/);
  assert.match(CREATE_VOTES, /PRIMARY KEY \(question_id, voter_hash\)/);
  assert.match(CREATE_VOTES, /CHECK \(vote IN \(-1, 0, 1\)\)/);
});
