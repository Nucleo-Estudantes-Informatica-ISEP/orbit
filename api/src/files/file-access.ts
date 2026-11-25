import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Prisma, SystemPermission } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-request';
import { browserOrigins } from '../config/auth.config';

export function validFileKey(key: string) {
  return (
    key.length > 0 &&
    key.length <= 1024 &&
    !key.includes('\\') &&
    [...key].every(
      (character) =>
        character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
    ) &&
    key
      .split('/')
      .every((segment) => segment && segment !== '.' && segment !== '..')
  );
}

function legacyPrefixes() {
  const origins = [
    ...new Set([
      ...browserOrigins(),
      process.env.APP_URL || 'https://orbit.nei-isep.org',
      ...(process.env.FILE_LEGACY_ORIGINS?.split(',').map((origin) =>
        origin.trim(),
      ) ?? []),
    ]),
  ].map((origin) => origin.replace(/\/$/, ''));
  return ['', ...origins].flatMap((origin) => [
    `${origin}/api/files/`,
    `${origin}/files/`,
  ]);
}

export function attachmentKey(
  value: string | null | undefined,
  prefixes = legacyPrefixes(),
) {
  if (!value) return null;
  const prefix = prefixes.find((candidate) => value.startsWith(candidate));
  if (!prefix && /^https?:\/\//i.test(value)) return null;
  const key = prefix ? value.slice(prefix.length).split(/[?#]/u, 1)[0] : value;
  let decoded: string;
  try {
    decoded = prefix ? decodeURIComponent(key) : key;
  } catch {
    throw new BadRequestException('Invalid file key');
  }
  if (
    !validFileKey(decoded) ||
    (!prefix && /^[a-z][a-z0-9+.-]*:/i.test(value))
  ) {
    throw new BadRequestException('Invalid file key');
  }
  return decoded;
}

export function safeStoredAttachment(
  value: string | null | undefined,
  prefixes?: string[],
) {
  try {
    return attachmentKey(value, prefixes) ?? value;
  } catch {
    return null;
  }
}

export async function lockFile(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 23))`;
}

export async function requireOwnedAttachments(
  tx: Prisma.TransactionClient,
  actorId: string,
  requested: (string | null | undefined)[],
  existing: (string | null | undefined)[] = [],
) {
  const keys = [
    ...new Set(requested.filter((value): value is string => !!value)),
  ].sort();
  if (!keys.length) return;
  const previous = new Set(existing);
  for (const key of keys) {
    if (!validFileKey(key)) throw new BadRequestException('Invalid file key');
    await lockFile(tx, key);
  }
  const rows = await tx.uploadedFile.findMany({ where: { key: { in: keys } } });
  const newKeys = keys.filter((key) => !previous.has(key));
  for (let start = 0; start < newKeys.length; start += 50) {
    const references = await attachmentPermissions(
      tx,
      newKeys.slice(start, start + 50),
    );
    if (references.size) {
      throw new ForbiddenException(
        'Only your own uploads that are no longer attached can be attached',
      );
    }
  }
  const owned = new Map(rows.map((row) => [row.key, row]));
  for (const key of keys) {
    const file = owned.get(key);
    if (
      file?.deletedAt ||
      (!previous.has(key) && (!file || file.uploadedById !== actorId))
    ) {
      throw new ForbiddenException('Only your own uploads can be attached');
    }
  }
}

export async function attachmentPermissions(
  tx: Prisma.TransactionClient,
  keys: string[],
  { fullInventory = false } = {},
) {
  const permissions = new Map<string, Set<SystemPermission>>();
  if (!keys.length) return permissions;
  const requested = new Set(keys);
  const add = (
    key: string | null | undefined,
    permission: SystemPermission,
  ) => {
    if (!key || !requested.has(key)) return;
    const set = permissions.get(key) ?? new Set();
    set.add(permission);
    permissions.set(key, set);
  };
  // Resolve legacy URLs with the same decoder for single files and listings.
  const prefixes = legacyPrefixes();
  const urlFilters = [
    { in: keys },
    ...prefixes.map((startsWith) => ({ startsWith })),
  ];
  const [debts, incidents, inventory, plans, candidates, resources] =
    await Promise.all([
      tx.debt.findMany({
        where: fullInventory ? undefined : { fileKeys: { hasSome: keys } },
        select: { fileKeys: true },
      }),
      tx.incident.findMany({
        where: fullInventory ? undefined : { fileKeys: { hasSome: keys } },
        select: { fileKeys: true },
      }),
      tx.inventoryItem.findMany({
        where: { photoKey: fullInventory ? { not: null } : { in: keys } },
        select: { photoKey: true },
      }),
      tx.plan.findMany({
        where: { fileKey: fullInventory ? { not: null } : { in: keys } },
        select: { fileKey: true },
      }),
      tx.candidate.findMany({
        where: fullInventory
          ? { cvUrl: { not: null } }
          : { OR: urlFilters.map((cvUrl) => ({ cvUrl })) },
        select: { cvUrl: true },
      }),
      tx.resource.findMany({
        where: fullInventory
          ? undefined
          : { OR: urlFilters.map((url) => ({ url })) },
        select: { url: true },
      }),
    ]);
  for (const row of debts)
    for (const key of row.fileKeys) add(key, 'DEBTS_READ');
  for (const row of incidents)
    for (const key of row.fileKeys) add(key, 'INCIDENTS_READ');
  for (const row of inventory) add(row.photoKey, 'INVENTORY_READ');
  for (const row of plans) add(row.fileKey, 'PLANS_READ');
  for (const row of candidates)
    add(safeStoredAttachment(row.cvUrl, prefixes), 'RECRUITMENT_READ');
  for (const row of resources)
    add(safeStoredAttachment(row.url, prefixes), 'RESOURCES_READ');
  return permissions;
}

export function canReadFile(
  actor: AuthenticatedUser,
  file:
    | {
        uploadedById: string | null;
        attached: boolean;
        deletedAt: Date | null;
      }
    | undefined,
  required: Set<SystemPermission> | undefined,
) {
  if (file?.deletedAt) return false;
  if (required?.size)
    return [...required].some((permission) =>
      actor.permissions.includes(permission),
    );
  if (!file || (file.attached && file.uploadedById === null))
    return actor.permissions.includes('FILES_VIEW');
  return file.uploadedById === actor.userId;
}
