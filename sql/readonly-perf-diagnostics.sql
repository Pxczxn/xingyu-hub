-- Read-only MySQL diagnostics for Xingyu SQL performance (batch 5.36).
-- Run on an authorized production replica or primary with a read-only account.
-- Do not use EXPLAIN ANALYZE. Do not SELECT business tables.
-- This script never dumps rows, emails, tokens, or SQL text from processlist.

SELECT VERSION() AS mysql_version,
       @@hostname AS hostname,
       @@port AS port,
       @@version_comment AS version_comment;

SHOW GLOBAL VARIABLES WHERE Variable_name IN (
  'slow_query_log',
  'slow_query_log_file',
  'long_query_time',
  'log_queries_not_using_indexes',
  'log_output',
  'performance_schema',
  'innodb_buffer_pool_size',
  'max_connections',
  'time_zone',
  'system_time_zone'
);

SHOW GLOBAL STATUS WHERE Variable_name IN (
  'Threads_connected',
  'Threads_running',
  'Max_used_connections',
  'Aborted_connects',
  'Questions',
  'Slow_queries',
  'Innodb_buffer_pool_reads',
  'Innodb_buffer_pool_read_requests',
  'Innodb_buffer_pool_pages_data',
  'Innodb_buffer_pool_pages_free',
  'Innodb_buffer_pool_pages_total',
  'Innodb_row_lock_waits',
  'Innodb_row_lock_time_avg'
);

SELECT COUNT(*) AS processlist_count,
       SUM(COMMAND = 'Sleep') AS sleep_threads,
       SUM(COMMAND <> 'Sleep') AS active_threads
FROM information_schema.PROCESSLIST;

-- Estimated row counts only (no table scans).
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, CREATE_TIME, UPDATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'sys_api_access_log',
    'sys_job_log',
    'sys_job',
    'sys_login_log',
    'sys_oper_log',
    'sys_user',
    'sys_user_post',
    'search_document',
    'content_like',
    'review_submission',
    'article',
    'reliable_event'
  )
ORDER BY TABLE_NAME;

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, CARDINALITY
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'sys_api_access_log',
    'sys_job_log',
    'sys_login_log',
    'sys_oper_log',
    'sys_user_post',
    'search_document',
    'review_submission'
  )
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- Digest text is normalized; limit 20 by wait time. Skip if performance_schema is off.
SELECT SCHEMA_NAME,
       LEFT(DIGEST_TEXT, 200) AS digest_text,
       COUNT_STAR,
       ROUND(SUM_TIMER_WAIT / 1e12, 3) AS sum_seconds,
       ROUND(AVG_TIMER_WAIT / 1e12, 4) AS avg_seconds,
       ROUND(MAX_TIMER_WAIT / 1e12, 4) AS max_seconds,
       SUM_ROWS_EXAMINED,
       SUM_ROWS_SENT
FROM performance_schema.events_statements_summary_by_digest
WHERE SCHEMA_NAME = DATABASE()
   OR SCHEMA_NAME IS NULL
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 20;

SELECT EVENT_NAME,
       COUNT_STAR,
       ROUND(SUM_TIMER_WAIT / 1e12, 3) AS sum_seconds
FROM performance_schema.events_waits_summary_global_by_event_name
WHERE COUNT_STAR > 0
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 15;
