-- Search discovery only includes PUBLIC articles. UNLISTED remains direct-link readable;
-- PRIVATE remains owner-only. Keep rows for idempotent restoration, but mark them removed.
UPDATE search_document sd
INNER JOIN published_revision pr ON pr.article_id = sd.object_id
INNER JOIN formal_revision fr ON fr.id = pr.formal_revision_id
SET sd.removed_at = CURRENT_TIMESTAMP
WHERE sd.object_type = 'ARTICLE'
  AND sd.removed_at IS NULL
  AND fr.visibility <> 'PUBLIC';
