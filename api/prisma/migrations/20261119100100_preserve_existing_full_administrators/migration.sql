UPDATE "Role"
SET permissions = permissions || ARRAY['USERS_MANAGE_CREDENTIALS', 'ROLES_ASSIGN']::"SystemPermission"[]
WHERE permissions @> ARRAY['USERS_CREATE', 'USERS_UPDATE', 'USERS_DELETE', 'ROLES_CREATE', 'ROLES_UPDATE', 'ROLES_DELETE']::"SystemPermission"[];
