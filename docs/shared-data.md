# Deploy Orbit with private S3 storage

Both production Compose files require a separately maintained S3-compatible store. Use `docker-compose.coolify.yml` for the embedded PostgreSQL service or `docker-compose.shared.yml` for shared PostgreSQL. Preserve the previous configuration and volumes until the cutover is verified.

Set `AUTH_TRUST_PROXY_HOPS` for Coolify before deployment. Verify the forwarded client IP through the public frontend and ensure the API has no direct public route. Use the hop count that reaches the client in this verified chain. Shared Compose keeps an untrusted-proxy default for direct deployments.

## Required Coolify variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime PostgreSQL identity with DML permissions only, e.g. `postgresql://orbit_prod_runtime:<password>@<shared-postgres>:5432/orbit_prod?schema=orbit` |
| `MIGRATION_DATABASE_URL` | Separate identity owning only the Orbit database/schema, e.g. `postgresql://orbit_prod_migrator:<password>@<shared-postgres>:5432/orbit_prod?schema=orbit` |
| `SHARED_DATA_NETWORK` | Existing external Docker network when using the shared Compose file |
| `MINIO_ENDPOINT` | Private or otherwise restricted S3 endpoint hostname, without a URL scheme |
| `MINIO_PORT` | S3 API port. Defaults to `443` for embedded PostgreSQL or `9000` for the shared-data model. |
| `MINIO_USE_SSL` | `true` for a TLS endpoint, `false` for the isolated internal Docker endpoint |
| `MINIO_REGION` | S3 signing region. Defaults to `us-east-1`. |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | Orbit-only S3 identity; never MinIO root credentials |
| `MINIO_BUCKET` | Pre-created private Orbit bucket |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Existing production SMTP settings; port 465 and TLS are retained |
| `SERVICE_BASE64_64_JWT`, `REFRESH_TOKEN_SECRET` | Independently generated signing and token-fingerprint keys of at least 32 bytes each |
| `FILE_LEGACY_ORIGINS` | Comma-separated historical Orbit origins to recognize in stored attachment links |

Keep signing and SMTP settings during a data-only migration. The security upgrade requires its new fingerprint secret and access-token claims. Plan for members to sign in again and request fresh password reset emails.

The API and migrator join the shared network. The frontend stays on the application network. Only the API should serve file downloads/uploads; neither PostgreSQL nor the MinIO console needs a public route. Configure independent values for every development/preview deployment; never clone production credentials into previews.

## Provisioning and permissions

- Provision a separate Orbit database and application schema for a new shared deployment. For an existing embedded database, keep the existing schema unless the cutover explicitly migrates it. Provision a non-superuser migration identity and a restricted runtime identity before running either Compose variant. Transfer ownership of existing application tables, types and migration history to the migration identity, using the database administrator during the maintenance window.
- Runtime needs SELECT/INSERT/UPDATE/DELETE on application tables and usage on sequences. Keep `_prisma_migrations` writable only by the migration identity. API startup rejects a role with schema creation, migration-table writes, superuser, bypass-RLS, database-creation, or role-creation privileges.
- The migration user owns the Orbit schema, has no global role/database creation privileges and supplies default privileges for future runtime tables/sequences. The API waits for successful migration before startup.
- Pre-create the private bucket and configure a maintained, patched S3 endpoint. Its application identity needs bucket location/listing and object get/put/delete only within that bucket. Orbit's startup bucket-existence check must succeed with the restricted identity.

## Cutover and verification

1. Back up the source database, objects and encrypted deployment configuration, and prove restoration. Record existing image digests and signing settings.
2. Restore an isolated copy into PostgreSQL 16. Preserve `_prisma_migrations`, app IDs, hashes, roles and sessions. Rehearse mapping `public` to `orbit`; use `schema=orbit` in both connection URLs.
3. Copy files through S3 under the same keys and preserve content types. Compare complete object counts, bytes and SHA-256 checksums. Retain the source objects and volume for rollback.
4. Verify the deployed API image against the isolated copy: migrations, login/refresh/logout, authorization, file upload/download/delete and representative read flows. Prove runtime cannot create tables or access other databases/buckets; anonymous file reads must fail.
5. Promote the reviewed configuration through `dev` to `main`. During the production write window stop/drain API writes, take a final database dump and object delta copy, restore/validate, then change Coolify Compose location and credentials. Keep source volumes intact.
6. Run the production migrator, verify API/frontend health and authenticated operations, then reopen writes. Confirm the running API uses the intended database/schema/bucket and automatic redeploy uses the shared Compose file.

Before target writes, rollback restores the saved Compose/env/image and original volumes. After new writes, freeze again and reconcile DB changes plus new/changed/deleted objects before switching back; a blind URL reversal would lose data. Stop old DB/MinIO only after successful cutover, retain volumes through the rollback period, and delete them only after backup/retention approval. Never delete the whole Orbit application or use broad volume pruning.
