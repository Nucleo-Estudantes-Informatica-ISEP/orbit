-- Do not rewrite the already-applied operational-defaults migration. Record a
-- system reconciliation event for each stock resource currently in its enabled,
-- configured automatic state. This is an observation, not an invented before-
-- image or an administrator action; later manual choices are not changed.
INSERT INTO "AuditLog" ("id", "performedById", "action", "entity", "entityId", "createdAt")
SELECT md5('orbit:access:operational-defaults:' || "id")::uuid::text,
       NULL, 'ACCESS_OPERATIONAL_DEFAULTS_RECONCILED', 'AccessResource', "id", CURRENT_TIMESTAMP
FROM "AccessResource"
WHERE "enabled" = true AND "automatic" = true AND "remoteId" <> 'CONFIGURE_ME'
  AND "id" IN (
    'a8b1a10f-49a5-47a3-aa55-731d2cb3088f',
    '5b08139b-9c69-4e69-aa54-649bf3539cbc',
    '1948a016-81f2-408e-a6cb-0ffe91601769',
    'c16de9e7-6933-4956-a119-c23be1f5fcea',
    '91091a77-0190-4465-ad84-2f5cd81ab626')
ON CONFLICT ("id") DO NOTHING;
