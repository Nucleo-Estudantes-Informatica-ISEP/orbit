export type Provider =
  | "DISCORD"
  | "GITHUB"
  | "GOOGLE_DRIVE"
  | "WHATSAPP"
  | "FIGMA"
  | "CODA"
  | "FREEDCAMP"
  | "EMAIL";
export const providers: Provider[] = [
  "DISCORD",
  "GITHUB",
  "GOOGLE_DRIVE",
  "WHATSAPP",
  "FIGMA",
  "CODA",
  "FREEDCAMP",
  "EMAIL",
];
export const positions = [
  "MEMBER",
  "COORDINATOR",
  "CO_COORDINATOR",
  "BOARD",
  "PRESIDENCY",
  "ALUMNI",
];
export const resourceTypes: Record<Provider, string[]> = {
  DISCORD: ["DISCORD_ROLE"],
  GITHUB: ["GITHUB_ORG", "GITHUB_TEAM"],
  GOOGLE_DRIVE: ["DRIVE_FOLDER"],
  WHATSAPP: ["WHATSAPP_GROUP"],
  FIGMA: ["FIGMA_TEAM"],
  CODA: ["MANUAL"],
  FREEDCAMP: ["MANUAL"],
  EMAIL: ["MANUAL"],
};
export interface AccessResource {
  id: string;
  name: string;
  provider: Provider;
  remoteId: string;
  containerId?: string;
  resourceType: string;
  automatic: boolean;
  sensitive: boolean;
  enabled: boolean;
  departmentIds: string[];
  instructions: string;
  adminUrl?: string;
  version: number;
}
export interface AccessPolicy {
  id: string;
  name: string;
  departmentIds: string[];
  positions: string[];
  resourceIds: string[];
  enabled: boolean;
  version: number;
}
export interface AccessConfiguration {
  resources: AccessResource[];
  policies: AccessPolicy[];
  departments: { id: string; name: string }[];
  permissions: string[];
  formUrl?: string;
  intakeConfigured: boolean;
  intakeSources?: IntakeSource[];
  executorEnabled?: boolean;
  dryRun?: boolean;
}
export type IntakeSource = "FORMS" | "SHEETS";
export function availableIntakeSources(
  config: Pick<AccessConfiguration, "intakeSources" | "intakeConfigured">,
): IntakeSource[] {
  const configured =
    config.intakeSources ?? (config.intakeConfigured ? ["SHEETS"] : []);
  return (["FORMS", "SHEETS"] as const).filter((source) =>
    configured.includes(source),
  );
}
export interface IntakeResponse {
  source?: IntakeSource;
  submittedAt?: string;
  key: string;
  name: string;
  email: string;
  departmentIds: string[];
  positions: string[];
  accounts: Record<string, string>;
}
export interface SelectedOperation {
  accountUsername?: string;
  resourceId: string;
  action: "GRANT" | "REVOKE" | "VERIFY";
  providerUserId?: string;
  accountEmail?: string;
  verificationNote?: string;
  exceptionReason?: string;
}
export interface AccessOperation {
  id: string;
  action: SelectedOperation["action"];
  provider: Provider;
  resourceSnapshot: AccessResource;
  providerUserId?: string;
  accountEmail?: string;
  verificationNote?: string;
  exceptionReason?: string;
  status: string;
  automatic: boolean;
  attempts: number;
  lastError?: string;
  result?: {
    detail?: string;
    remoteId?: string;
    accountName?: string;
    identitySource?: "FORMS" | "SHEETS" | "OPERATOR";
  };
  evidence: {
    id: string;
    performedById: string;
    outcome: string;
    note: string;
    createdAt: string;
  }[];
}
export interface LifecycleProcess {
  id: string;
  kind: string;
  status: string;
  targetName: string;
  targetEmail: string;
  targetDepartmentIds: string[];
  targetPositions: string[];
  requestedByUserId: string;
  reason: string;
  source: { type: string; note?: string; responseKey?: string };
  operations: AccessOperation[];
  approvals: {
    id: string;
    decidedById: string;
    approved: boolean;
    note: string;
    createdAt: string;
  }[];
  createdAt: string;
}

export function intakeAccount(
  resource: AccessResource,
  intake?: IntakeResponse,
): Pick<
  SelectedOperation,
  "providerUserId" | "accountEmail" | "accountUsername"
> {
  const accounts = intake?.accounts || {};
  const ids: Partial<Record<Provider, string>> = {
    DISCORD: accounts.discordUsername || accounts.discordId,
    GITHUB: accounts.githubUsername || accounts.githubId,
    GOOGLE_DRIVE: accounts.googleEmail,
    WHATSAPP: accounts.phone,
    FIGMA: accounts.figmaEmail,
    CODA: accounts.codaEmail,
    FREEDCAMP: accounts.freedcampEmail,
    EMAIL: accounts.institutionalEmail,
  };
  const emails: Partial<Record<Provider, string>> = {
    GOOGLE_DRIVE: accounts.googleEmail,
    FIGMA: accounts.figmaEmail,
    CODA: accounts.codaEmail,
    FREEDCAMP: accounts.freedcampEmail,
    EMAIL: accounts.institutionalEmail,
  };
  return {
    ...(["DISCORD", "GITHUB"].includes(resource.provider) &&
    (resource.provider === "DISCORD"
      ? accounts.discordUsername
      : accounts.githubUsername)
      ? { accountUsername: ids[resource.provider] || undefined }
      : { providerUserId: ids[resource.provider] || undefined }),
    accountEmail: emails[resource.provider] || undefined,
  };
}

export function cleanOperation(
  operation: SelectedOperation,
): SelectedOperation {
  return Object.fromEntries(
    Object.entries(operation).filter(
      ([, value]) => typeof value !== "string" || value.trim().length > 0,
    ),
  ) as unknown as SelectedOperation;
}

export function canConfirmManually(operation: AccessOperation) {
  return (
    ["AWAITING_MANUAL", "AWAITING_ACCOUNT", "FAILED"].includes(
      operation.status,
    ) &&
    (!operation.automatic || operation.status === "AWAITING_MANUAL")
  );
}
