import type {
  AccessPolicy,
  Provider,
  SelectedOperation,
} from "./access-lifecycle";

const permissionId = (value?: string) => /^\d+$/.test(value || "");

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
  if (kind === "CHANGE_ACCESS") return "VERIFY";
  if (kind === "ALUMNI_TRANSITION")
    return policies.some(
      (policy) =>
        policy.enabled &&
        (!policy.departmentIds?.length ||
          policy.departmentIds.some((id) => departmentIds.includes(id))) &&
        policy.positions.includes("ALUMNI") &&
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
