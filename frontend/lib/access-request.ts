import type {
  AccessPolicy,
  AccessOperation,
  AccessResource,
  Provider,
  SelectedOperation,
} from "./access-lifecycle";

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
          ...(["DISCORD", "GITHUB"].includes(resource.provider) &&
          op.result?.accountName
            ? { accountUsername: op.result.accountName }
            : {}),
          providerUserId:
            resource.provider === "GOOGLE_DRIVE"
              ? op.accountEmail || op.result?.remoteId || op.providerUserId
              : ["DISCORD", "GITHUB"].includes(resource.provider) &&
                  op.result?.accountName
                ? undefined
                : op.result?.remoteId || op.providerUserId,
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
  provider?: Provider,
): SelectedOperation {
  return {
    ...operation,
    ...(["DISCORD", "GITHUB"].includes(provider || "")
      ? { accountUsername: value, providerUserId: undefined }
      : { providerUserId: value }),
    verificationNote:
      operation.providerUserId === value
        ? operation.verificationNote
        : undefined,
  };
}

export function changeAccountEmail(
  operation: SelectedOperation,
  _provider: Provider,
  value: string,
): SelectedOperation {
  return {
    ...operation,
    accountEmail: value,
    providerUserId: value,
    verificationNote:
      operation.accountEmail === value && operation.providerUserId === value
        ? operation.verificationNote
        : undefined,
  };
}

export function changeAccessAction(
  operation: SelectedOperation,
  provider: Provider,
  action: SelectedOperation["action"],
): SelectedOperation {
  if (provider !== "GOOGLE_DRIVE" || !operation.accountEmail)
    return { ...operation, action };
  const principal = operation.accountEmail;
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
