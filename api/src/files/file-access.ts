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

export function attachmentKey(value: string | null | undefined) {
  if (!value) return null;
  const prefix = legacyPrefixes().find((candidate) =>
    value.startsWith(candidate),
  );
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

export function safeStoredAttachment(value: string | null | undefined) {
  try {
    return attachmentKey(value) ?? value;
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
  const owned = new Map(rows.map((row) => [row.key, row]));
  const newlyAttached: string[] = [];
  for (const key of keys) {
    const file = owned.get(key);
    if (
      file?.deletedAt ||
      (!previous.has(key) &&
        (!file || file.uploadedById !== actorId || file.attached))
    ) {
      throw new ForbiddenException('Only your own uploads can be attached');
    }
    if (!previous.has(key)) newlyAttached.push(key);
  }
  if (newlyAttached.length) {
    await tx.uploadedFile.updateMany({
      where: { key: { in: newlyAttached } },
      data: { attached: true },
    });
  }
}

export async function attachmentPermissions(
  tx: Prisma.TransactionClient,
  keys: string[],
) {
  const permissions = new Map<string, Set<SystemPermission>>();
  if (!keys.length) return permissions;
  const add = (key: string | null, permission: SystemPermission) => {
    if (!key) return;
    const set = permissions.get(key) ?? new Set();
    set.add(permission);
    permissions.set(key, set);
  };
  const urls = keys.flatMap((key) =>
    legacyPrefixes().flatMap((prefix) => [
      prefix + key,
      prefix + key.split('/').map(encodeURIComponent).join('/'),
      prefix + encodeURIComponent(key),
    ]),
  );
  const urlFilters: Prisma.StringFilter[] = urls.flatMap((url) => [
    { equals: url },
    { startsWith: url + '?' },
    { startsWith: url + '#' },
  ]);
  const [debts, incidents, inventory, plans, candidates, resources] =
    await Promise.all([
      tx.debt.findMany({
        where: { fileKeys: { hasSome: keys } },
        select: { fileKeys: true },
      }),
      tx.incident.findMany({
        where: { fileKeys: { hasSome: keys } },
        select: { fileKeys: true },
      }),
      tx.inventoryItem.findMany({
        where: { photoKey: { in: keys } },
        select: { photoKey: true },
      }),
      tx.plan.findMany({
        where: { fileKey: { in: keys } },
        select: { fileKey: true },
      }),
      tx.candidate.findMany({
        where: {
          OR: [
            { cvUrl: { in: keys } },
            ...urlFilters.map((cvUrl) => ({ cvUrl })),
          ],
        },
        select: { cvUrl: true },
      }),
      tx.resource.findMany({
        where: {
          OR: [{ url: { in: keys } }, ...urlFilters.map((url) => ({ url }))],
        },
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
    add(attachmentKey(row.cvUrl), 'RECRUITMENT_READ');
  for (const row of resources) add(attachmentKey(row.url), 'RESOURCES_READ');
  return permissions;
}

export function canReadFile(
  actor: AuthenticatedUser,
  file:
    | { uploadedById: string | null; attached: boolean; deletedAt: Date | null }
    | undefined,
  required: Set<SystemPermission> | undefined,
) {
  if (file?.deletedAt) return false;
  if (required?.size)
    return [...required].some((permission) =>
      actor.permissions.includes(permission),
    );
  return file
    ? !file.attached && file.uploadedById === actor.userId
    : actor.permissions.includes('FILES_VIEW');
}
