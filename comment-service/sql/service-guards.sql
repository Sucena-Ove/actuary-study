-- Run after the unmodified official waline.pgsql, on the same Neon database.
-- Atomic rate limiting for concurrent/serverless instances. Keys are HMACs,
-- never plain IPs; normal Waline comment rows still contain the request IP.
CREATE TABLE IF NOT EXISTS wl_request_limit (
  key varchar(64) PRIMARY KEY,
  last_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS wl_request_limit_last_at ON wl_request_limit (last_at);
CREATE INDEX IF NOT EXISTS wl_comment_question_status ON wl_comment (url, status);
CREATE INDEX IF NOT EXISTS wl_comment_ip_inserted ON wl_comment (ip, insertedat);

