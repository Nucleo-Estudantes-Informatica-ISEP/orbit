import type {
  AccessPolicy,
  AccessOperation,
  AccessResource,
  Provider,
  SelectedOperation,
} from "./access-lifecycle";

const permissionId = (value?: string) => /^\d+$/.test(value || "");

export function reuseAccessOperations(
  previous: AccessOperation[],
  resources: AccessResource[],
): SelectedOperation[] {
  return previous.flatMap((op) => {
    const resource = resources.find(
      (resource) => resource.id === op.resourceSnapshot.id && resource.enabled,
    );
    if (!resource) return [];
    return [
      changeAccessAction(
        {
          resourceId: resource.id,
          action: "VERIFY",
          providerUserId: op.result?.remoteId || op.providerUserId,
          accountEmail: op.accountEmail,
        },
        resource.provider,
        "VERIFY",
      ),
    ];
  });
}

export function restoreAccessDefaults(
  current: SelectedOperation[],
  defaults: SelectedOperation[],
  resources: AccessResource[],
): SelectedOperation[] {
  const recommendedIds = new Set(defaults.map((op) => op.resourceId));
  return [
    ...defaults.map((defaultOperation) => {
      const existing = current.find(
        (op) => op.resourceId === defaultOperation.resourceId,
      );
      const resource = resources.find(
        (resource) => resource.id === defaultOperation.resourceId,
      );
      return existing && resource
        ? changeAccessAction(
            { ...defaultOperation, ...existing },
            resource.provider,
            defaultOperation.action,
          )
        : defaultOperation;
    }),
    ...current.filter((op) => !recommendedIds.has(op.resourceId)),
  ];
}

export function hasOriginPosition(positions: string[]): boolean {
  return positions.some((position) => position !== "ALUMNI");
}

export function changeRemoteIdentity(
  operation: SelectedOperation,
  value: string,
): SelectedOperation {
  return {
    ...operation,
    providerUserId: value,
    verificationNote:
      operation.providerUserId === value
        ? operation.verificationNote
        : undefined,
  };
}

export function changeAccountEmail(
  operation: SelectedOperation,
  provider: Provider,
  value: string,
): SelectedOperation {
  const bindPrincipal =
    provider !== "GOOGLE_DRIVE" ||
    (operation.action === "GRANT" && !permissionId(operation.providerUserId));
  return {
    ...operation,
    accountEmail: value,
    ...(bindPrincipal ? { providerUserId: value } : {}),
    verificationNote:
      operation.accountEmail === value &&
      (!bindPrincipal || operation.providerUserId === value)
        ? operation.verificationNote
        : undefined,
  };
}

export function changeAccessAction(
  operation: SelectedOperation,
  provider: Provider,
  action: SelectedOperation["action"],
): SelectedOperation {
  if (provider !== "GOOGLE_DRIVE" || permissionId(operation.providerUserId))
    return { ...operation, action };
  const principal = action === "GRANT" ? operation.accountEmail : undefined;
  return {
    ...operation,
    action,
    providerUserId: principal,
    verificationNote:
      principal === operation.providerUserId
        ? operation.verificationNote
        : undefined,
  };
}

export function defaultAccessAction(
  kind: string,
  resourceId: string,
  policies: (Pick<AccessPolicy, "enabled" | "positions" | "resourceIds"> &
    Partial<Pick<AccessPolicy, "departmentIds">>)[],
  departmentIds: string[] = [],
): SelectedOperation["action"] {
  if (kind === "OFFBOARD") return "REVOKE";
  if (kind === "ALUMNI_TRANSITION")
    return policies.some(
      (policy) =>
        policy.enabled &&
        (!policy.departmentIds?.length ||
          policy.departmentIds.some((id) => departmentIds.includes(id))) &&
        (!policy.positions.length || policy.positions.includes("ALUMNI")) &&
        policy.resourceIds.includes(resourceId),
    )
      ? "GRANT"
      : "REVOKE";
  return "GRANT";
}

export function requestPositions(kind: string, positions: string[]): string[] {
  return kind === "ALUMNI_TRANSITION"
    ? [...new Set([...positions, "ALUMNI"])]
    : positions;
}
