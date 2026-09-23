# Deploy Orbit on shared PostgreSQL and MinIO

Use `/docker-compose.shared.yml` as the Coolify Compose location after the database and object migration has been verified. This variant builds the same API/frontend and runs the same Prisma migrator. It does not create an embedded database or MinIO server. The original `/docker-compose.coolify.yml` remains available for independent installations and rollback with their original volumes.

## Required Coolify variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime PostgreSQL identity with DML permissions only, e.g. `postgresql://orbit_prod_runtime:<password>@<shared-postgres>:5432/orbit_prod?schema=orbit` |
| `MIGRATION_DATABASE_URL` | Separate identity owning only the Orbit database/schema, e.g. `postgresql://orbit_prod_migrator:<password>@<shared-postgres>:5432/orbit_prod?schema=orbit` |
| `SHARED_DATA_NETWORK` | Existing external Docker network for the shared services |
| `MINIO_ENDPOINT` | Internal shared MinIO hostname, without a URL scheme |
| `MINIO_PORT` | S3 API port; defaults to `9000` |
| `MINIO_USE_SSL` | `true` for a TLS endpoint, `false` for the isolated internal Docker endpoint |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | Orbit-only S3 identity; never MinIO root credentials |
| `MINIO_BUCKET` | Pre-created private Orbit bucket |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Existing production SMTP settings; port 465 and TLS are retained |

Keep production signing/refresh-token secrets, `APP_URL`, SMTP and other application settings unchanged during a data-only migration. Existing users, password hashes, roles and sessions are application data in PostgreSQL; Supabase Auth is not involved.

The API and migrator join the shared network. The frontend stays on the application network. Only the API should serve file downloads/uploads; neither PostgreSQL nor the MinIO console needs a public route. Configure independent values for every development/preview deployment; never clone production credentials into previews.

## Provisioning and permissions

- Create a separate Orbit database and `orbit` schema. Restrict connectivity and schema privileges to the intended runtime/migration identities.
- Runtime needs SELECT/INSERT/UPDATE/DELETE on application tables and usage on sequences, without DDL, role creation, superuser or cross-database access. Keep `_prisma_migrations` writable only by the migration identity.
- The migration user owns the Orbit schema, has no global role/database creation privileges and supplies default privileges for future runtime tables/sequences. The API waits for successful migration before startup.
- Pre-create the private bucket. Its application identity needs bucket location/listing and object get/put/delete/multipart operations only within that bucket. It must not create arbitrary buckets or administer MinIO. Orbit's startup bucket-existence check must succeed without root credentials.

## Cutover and verification

1. Back up the source database, objects and encrypted deployment configuration, and prove restoration. Record existing image digests and signing settings.
2. Restore an isolated copy into PostgreSQL 16. Preserve `_prisma_migrations`, app IDs, hashes, roles and sessions. Rehearse mapping `public` to `orbit`; use `schema=orbit` in both connection URLs.
3. Copy files through S3 under the same keys/content types. Compare complete object counts, bytes and SHA-256 checksums. Do not delete source objects.
4. Verify the deployed API image against the isolated copy: migrations, login/refresh/logout, authorization, file upload/download/delete and representative read flows. Prove runtime cannot create tables or access other databases/buckets; anonymous file reads must fail.
5. Promote the reviewed configuration through `dev` to `main`. During the production write window stop/drain API writes, take a final database dump and object delta copy, restore/validate, then change Coolify Compose location and credentials. Keep source volumes intact.
6. Run the production migrator, verify API/frontend health and authenticated operations, then reopen writes. Confirm the running API uses the intended database/schema/bucket and automatic redeploy uses the shared Compose file.

Before target writes, rollback restores the saved Compose/env/image and original volumes. After new writes, freeze again and reconcile DB changes plus new/changed/deleted objects before switching back; a blind URL reversal would lose data. Stop old DB/MinIO only after successful cutover, retain volumes through the rollback period, and delete them only after backup/retention approval. Never delete the whole Orbit application or use broad volume pruning.
