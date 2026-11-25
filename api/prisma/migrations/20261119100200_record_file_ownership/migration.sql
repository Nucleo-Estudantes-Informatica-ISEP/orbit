CREATE TABLE "UploadedFile" (
    "key" TEXT NOT NULL,
    "uploadedById" TEXT,
    "attached" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "UploadedFile_uploadedById_idx" ON "UploadedFile"("uploadedById");
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION pg_temp.orbit_decode_file_key(value TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
    RETURN (
        SELECT convert_from(decode(string_agg(
            CASE WHEN piece[1] ~ '^%[[:xdigit:]]{2}$' THEN substr(piece[1], 2)
                 ELSE encode(convert_to(piece[1], 'UTF8'), 'hex') END,
            '' ORDER BY position
        ), 'hex'), 'UTF8')
        FROM regexp_matches(value, '(%[[:xdigit:]]{2}|.)', 'g') WITH ORDINALITY AS parts(piece, position)
    );
EXCEPTION WHEN character_not_in_repertoire OR untranslatable_character THEN
    RETURN value;
END $$;

INSERT INTO "UploadedFile" ("key", "attached")
SELECT DISTINCT key, true FROM (
    SELECT unnest("fileKeys") AS key FROM "Debt"
    UNION ALL SELECT unnest("fileKeys") FROM "Incident"
    UNION ALL SELECT "photoKey" FROM "InventoryItem"
    UNION ALL SELECT "fileKey" FROM "Plan"
    UNION ALL
    SELECT CASE
        WHEN link ~ '^(https?://[^/]+)?/(api/)?files/' THEN
            pg_temp.orbit_decode_file_key(regexp_replace(
                regexp_replace(link, '^(https?://[^/]+)?/(api/)?files/', ''),
                '[?#].*$', ''
            ))
        WHEN link !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:' THEN link
    END
    FROM (SELECT "cvUrl" AS link FROM "Candidate" UNION ALL SELECT "url" FROM "Resource") links
) attachments
WHERE key IS NOT NULL AND key <> ''
ON CONFLICT DO NOTHING;
