import { BadRequestException, ForbiddenException } from '@nestjs/common';

export function assertScope(
  departmentId: string,
  global: boolean,
  targets: string[],
) {
  if (
    !targets.length ||
    (!global && targets.some((id) => id !== departmentId))
  ) {
    throw new ForbiddenException('Pedido fora dos departamentos autorizados');
  }
}

export function assertDecision(
  requesterId: string,
  actorId: string,
  status: string,
) {
  if (requesterId === actorId)
    throw new ForbiddenException('Não pode decidir o próprio pedido');
  if (status !== 'PENDING_APPROVAL')
    throw new BadRequestException('Pedido não aguarda aprovação');
}

export function assertOperationIdentity(
  action: string,
  remoteId?: string | null,
  verification?: string | null,
) {
  if (
    action === 'REVOKE' &&
    (!remoteId?.trim() || !verification || verification.trim().length < 5)
  ) {
    throw new BadRequestException(
      'Revogação exige ID remoto e evidência de identidade verificada',
    );
  }
}

export function policyMatches(
  policy: { departmentIds: string[]; positions: string[] },
  departments: string[],
  positions: string[],
) {
  return (
    (!policy.departmentIds.length ||
      policy.departmentIds.some((id) => departments.includes(id))) &&
    (!policy.positions.length ||
      policy.positions.some((position) => positions.includes(position)))
  );
}

export function protectAdminLinks<T>(value: T, allowed: boolean): T {
  if (allowed) return value;
  const redact = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(redact);
    if (input && typeof input === 'object' && !(input instanceof Date))
      return Object.fromEntries(
        Object.entries(input).map(([key, child]) => [
          key,
          key === 'adminUrl' ? null : redact(child),
        ]),
      );
    return input;
  };
  return redact(value) as T;
}
