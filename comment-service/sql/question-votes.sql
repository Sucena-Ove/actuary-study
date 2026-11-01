-- Optional explicit migration: runtime also creates this table on first vote read.
-- Existing comments, users, counters and limiter tables remain unchanged.
BEGIN;
SELECT pg_advisory_xact_lock(236407, 2);
CREATE TABLE IF NOT EXISTS wl_question_vote (
  question_id bigint NOT NULL CHECK (question_id > 0),
  voter_hash varchar(64) NOT NULL CHECK (voter_hash ~ '^[a-f0-9]{64}$'),
  vote smallint NOT NULL CHECK (vote IN (-1, 0, 1)),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (question_id, voter_hash)
);
COMMIT;
