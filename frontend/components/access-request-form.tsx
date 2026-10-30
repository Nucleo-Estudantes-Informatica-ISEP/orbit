"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  LoaderCircle,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import {
  cleanOperation,
  intakeAccount,
  availableIntakeSources,
  intakePositions,
  positions,
} from "@/lib/access-lifecycle";
import type {
  AccessConfiguration,
  AccessResource,
  IntakeResponse,
  IntakeSource,
  LifecycleProcess,
  SelectedOperation,
} from "@/lib/access-lifecycle";
import {
  changeAccountEmail,
  changeRemoteIdentity,
  changeAccessAction,
  defaultAccessAction,
  requestPositions,
  reuseAccessOperations,
  restoreAccessDefaults,
  hasOriginPosition,
} from "@/lib/access-request";

const root = "/access-lifecycle";
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const teamProviders = ["FIGMA", "CODA", "FREEDCAMP", "EMAIL"];
type RequestPayload = {
  kind: string;
  targetName: string;
  targetEmail: string;
  targetDepartmentIds: string[];
  targetPositions: string[];
  reason: string;
  intakeKey?: string;
  intakeSource?: IntakeSource;
  sourceNote?: string;
  selectedOperations: SelectedOperation[];
};

export function AccessExecutionNotice({
  config,
}: {
  config: AccessConfiguration;
}) {
  const { t } = useLocale();
  if (config.executorEnabled === undefined) return null;
  const mode = !config.executorEnabled ? "off" : config.dryRun ? "dry" : "live";
  return (
    <div role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">
      <p className="font-medium">{t(`access.execution.${mode}`)}</p>
      <p className="mt-1 text-muted-foreground">
        {t(`access.execution.${mode}Help`)}
      </p>
    </div>
  );
}

export function AccessRequestForm({
  config,
  previous,
  onCreate,
}: {
  config: AccessConfiguration;
  previous?: LifecycleProcess;
  onCreate: (payload: RequestPayload) => Promise<void>;
}) {
  const { t, formatDate } = useLocale();
  const [step, setStep] = useState(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const stepBody = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stepBody.current?.scrollTo({ top: 0 });
    stepHeading.current?.focus({ preventScroll: true });
  }, [step]);
  const origins = availableIntakeSources(config);
  const [source, setSource] = useState<IntakeSource | "manual">(
    !previous ? origins[0] || "manual" : "manual",
  );
  const [intake, setIntake] = useState<IntakeResponse>();
  const [query, setQuery] = useState("");
  const [responses, setResponses] = useState<IntakeResponse[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "done">(
    "idle",
  );
  const searchVersion = useRef(0);
  const [kind, setKind] = useState(previous ? "CHANGE_ACCESS" : "ONBOARD");
  const [name, setName] = useState(previous?.targetName || "");
  const [email, setEmail] = useState(previous?.targetEmail || "");
  const [departments, setDepartments] = useState<string[]>(
    previous?.targetDepartmentIds || [],
  );
  const [targetPositions, setTargetPositions] = useState<string[]>(
    previous?.targetPositions || ["MEMBER"],
  );
  const [sourceNote, setSourceNote] = useState(
    previous ? `${t("access.reused")} ${previous.id}` : "",
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [operations, setOperations] = useState<SelectedOperation[]>(() =>
    reuseAccessOperations(previous?.operations || [], config.resources),
  );
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  const resources = config.resources.filter((resource) => resource.enabled);
  const suggested = resources.filter((resource) =>
    recommendedIds.includes(resource.id),
  );
  const additional = resources.filter(
    (resource) => !recommendedIds.includes(resource.id),
  );
  const selectedAdditional = operations.some(
    (op) => !recommendedIds.includes(op.resourceId),
  );
  const effectivePositions = requestPositions(kind, targetPositions);

  function chooseResponse(response: IntakeResponse) {
    searchVersion.current++;
    setIntake(response);
    setName(response.name);
    setEmail(response.email);
    setDepartments(response.departmentIds);
    setTargetPositions(intakePositions(kind, response));
    setOperations([]);
    setResponses([]);
    setSearchState("idle");
    setError("");
  }

  async function search() {
    if (source === "manual" || query.trim().length < 3) return;
    const version = ++searchVersion.current;
    setSearchState("loading");
    setError("");
    setResponses([]);
    try {
      const rows = await api.get<IntakeResponse[]>(
        `${root}/intake?query=${encodeURIComponent(query.trim())}&intakeSource=${source}`,
      );
      if (version !== searchVersion.current) return;
      setResponses(rows);
      setSearchState("done");
    } catch (err) {
      if (version !== searchVersion.current) return;
      setError(err instanceof Error ? err.message : t("access.failed"));
      setSearchState("idle");
    }
  }

  function defaultOperation(resource: AccessResource): SelectedOperation {
    const action = defaultAccessAction(
      kind,
      resource.id,
      config.policies,
      departments,
    );
    return changeAccessAction(
      {
        resourceId: resource.id,
        action,
        ...intakeAccount(resource, source !== "manual" ? intake : undefined),
      },
      resource.provider,
      action,
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (step === 0) {
      if (source !== "manual" && !intake) return;
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      if (step === 1) {
        if (!departments.length) {
          setError(t("access.chooseDepartment"));
          return;
        }
        if (
          kind === "ALUMNI_TRANSITION" &&
          !hasOriginPosition(targetPositions)
        ) {
          setError(t("access.chooseOriginPosition"));
          return;
        }
        const preview = await api.post<{ resources: AccessResource[] }>(
          `${root}/preview`,
          { departmentIds: departments, positions: effectivePositions },
        );
        setRecommendedIds(preview.resources.map((resource) => resource.id));
        setAdditionalOpen(
          operations.some(
            (op) =>
              !preview.resources.some(
                (resource) => resource.id === op.resourceId,
              ),
          ),
        );
        if (!operations.length)
          setOperations(preview.resources.map(defaultOperation));
        setStep(2);
      } else {
        if (!operations.length) {
          setError(t("access.chooseResource"));
          return;
        }
        if (
          operations.some((op) => {
            const resource = resources.find(
              (item) => item.id === op.resourceId,
            );
            return (
              resource &&
              (resource.sensitive || !recommendedIds.includes(resource.id)) &&
              (op.exceptionReason?.trim().length || 0) < 5
            );
          })
        ) {
          setAdditionalOpen(true);
          setError(t("access.justificationRequired"));
          return;
        }
        await onCreate({
          kind,
          targetName: name,
          targetEmail: email,
          targetDepartmentIds: departments,
          targetPositions: effectivePositions,
          reason,
          ...(source !== "manual" && intake
            ? { intakeKey: intake.key, intakeSource: source }
            : { sourceNote }),
          selectedOperations: operations.map(cleanOperation),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("access.failed"));
    } finally {
      setBusy(false);
    }
  }

  function updateOperation(next: SelectedOperation) {
    setOperations((items) =>
      items.map((op) => (op.resourceId === next.resourceId ? next : op)),
    );
  }

  function card(resource: AccessResource) {
    const op = operations.find((item) => item.resourceId === resource.id);
    const exception =
      resource.sensitive || !recommendedIds.includes(resource.id);
    const isEmail =
      teamProviders.includes(resource.provider) ||
      resource.provider === "GOOGLE_DRIVE";
    const identityLabel =
      resource.provider === "GOOGLE_DRIVE"
        ? "googleEmail"
        : isEmail
          ? "email"
          : resource.provider === "WHATSAPP"
            ? "phone"
            : resource.provider === "GITHUB"
              ? "githubId"
              : "discordId";
    const instructions =
      resource.instructions ===
      "Configurar identificadores e instruções; confirmar execução na plataforma."
        ? ""
        : resource.instructions;
    return (
      <section
        key={resource.id}
        aria-label={resource.name}
        className={`rounded-lg border p-4 ${op ? "border-primary/50 bg-primary/5" : ""}`}
      >
        <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="mt-1 accent-primary"
            checked={Boolean(op)}
            onChange={() =>
              setOperations((items) =>
                op
                  ? items.filter((item) => item.resourceId !== resource.id)
                  : [...items, defaultOperation(resource)],
              )
            }
          />
          <span className="flex flex-1 flex-wrap items-center gap-2">
            {resource.name}
            <Badge variant="outline">
              {t(
                resource.automatic
                  ? "access.automationCapable"
                  : "access.manual",
              )}
            </Badge>
            {exception && (
              <Badge variant={resource.sensitive ? "destructive" : "outline"}>
                {t(
                  resource.sensitive
                    ? "access.sensitive"
                    : "access.policyException",
                )}
              </Badge>
            )}
          </span>
        </label>
        {op && (
          <div className="mt-4 space-y-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {t(`access.providerHelp.${resource.provider}`)}
            </p>
            {instructions && (
              <p className="text-sm text-muted-foreground">{instructions}</p>
            )}
            <label className="grid gap-1.5 text-sm">
              {t("access.action")}
              <select
                className={selectClass}
                aria-label={t("access.action")}
                value={op.action}
                onChange={(event) =>
                  updateOperation(
                    changeAccessAction(
                      op,
                      resource.provider,
                      event.target.value as SelectedOperation["action"],
                    ),
                  )
                }
              >
                {(kind === "OFFBOARD"
                  ? ["REVOKE", "VERIFY"]
                  : kind === "ONBOARD"
                    ? ["GRANT", "VERIFY"]
                    : ["GRANT", "REVOKE", "VERIFY"]
                ).map((action) => (
                  <option key={action} value={action}>
                    {t(
                      kind === "ALUMNI_TRANSITION" && action === "GRANT"
                        ? "access.keepAccess"
                        : `access.actions.${action}`,
                    )}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              {t(`access.identity.${identityLabel}`)}
              <Input
                type={
                  isEmail
                    ? "email"
                    : resource.provider === "WHATSAPP"
                      ? "tel"
                      : "text"
                }
                required={op.action === "REVOKE"}
                maxLength={isEmail ? 254 : 200}
                autoComplete="off"
                value={
                  isEmail
                    ? op.accountEmail ||
                      (op.providerUserId?.includes("@")
                        ? op.providerUserId
                        : "") ||
                      ""
                    : op.accountUsername || op.providerUserId || ""
                }
                onChange={(event) =>
                  updateOperation(
                    isEmail
                      ? changeAccountEmail(
                          op,
                          resource.provider,
                          event.target.value,
                        )
                      : changeRemoteIdentity(
                          op,
                          event.target.value,
                          resource.provider,
                        ),
                  )
                }
              />
            </label>
            {resource.remoteId === "CONFIGURE_ME" && (
              <p
                role="status"
                className="rounded-md border border-amber-500/50 p-3 text-sm"
              >
                {t("access.configurationRequired")}
              </p>
            )}
            {["DISCORD", "GITHUB", "GOOGLE_DRIVE"].includes(
              resource.provider,
            ) && (
              <p className="text-sm text-muted-foreground">
                {t("access.automaticIdentityHelp")}
              </p>
            )}
            {exception && (
              <label className="grid gap-1.5 text-sm">
                {t(
                  resource.sensitive
                    ? "access.sensitiveReason"
                    : "access.exceptionReason",
                )}
                <Textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={2}
                  value={op.exceptionReason || ""}
                  onChange={(event) =>
                    updateOperation({
                      ...op,
                      exceptionReason: event.target.value,
                    })
                  }
                />
              </label>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <form
      className="flex min-h-0 flex-col gap-4"
      onSubmit={(event) => void submit(event)}
    >
      <h2 ref={stepHeading} tabIndex={-1} className="sr-only">
        {t(`access.step.${["person", "context", "access"][step]}`)}
      </h2>
      <ol
        aria-label={t("access.requestSteps")}
        className="grid shrink-0 grid-cols-3 gap-2 border-b pb-4"
      >
        {["person", "context", "access"].map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={`flex items-center gap-2 text-sm ${step === index ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${step === index ? "border-primary bg-primary text-primary-foreground" : ""}`}
            >
              {step > index ? <Check className="size-3.5" /> : index + 1}
            </span>
            {t(`access.step.${label}`)}
          </li>
        ))}
      </ol>
      <div ref={stepBody} className="min-h-0 space-y-5 overflow-y-auto pr-1">
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("access.personHelp")}
            </p>
            {config.intakeConfigured &&
              !config.permissions.includes("ACCESS_ALL_DEPARTMENTS") && (
                <p className="text-sm text-muted-foreground">
                  {t("access.intakeScope")}
                </p>
              )}
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={t("access.personSource")}
            >
              {(["FORMS", "SHEETS", "manual"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={source === value ? "default" : "outline"}
                  aria-pressed={source === value}
                  disabled={value !== "manual" && !origins.includes(value)}
                  title={
                    value !== "manual" && !origins.includes(value)
                      ? t("access.originUnavailable")
                      : undefined
                  }
                  onClick={() => {
                    setSource(value);
                    setIntake(undefined);
                    setOperations([]);
                    setError("");
                    searchVersion.current++;
                    setResponses([]);
                    setSearchState("idle");
                  }}
                >
                  {t(`access.sourceMode.${value}`)}
                </Button>
              ))}
            </div>
            {source !== "manual" ? (
              <>
                <div className="space-y-2 rounded-lg border p-4">
                  <label
                    htmlFor="intake-search"
                    className="text-sm font-medium"
                  >
                    {t(`access.intake.${source}`)}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="intake-search"
                      value={query}
                      placeholder={t("access.search")}
                      onChange={(event) => {
                        searchVersion.current++;
                        setQuery(event.target.value);
                        setResponses([]);
                        setSearchState("idle");
                        setError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void search();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        query.trim().length < 3 || searchState === "loading"
                      }
                      onClick={() => void search()}
                      aria-label={t("access.search")}
                    >
                      {searchState === "loading" ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Search className="size-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("access.searchHelp")}
                  </p>
                  <div aria-live="polite" className="space-y-2">
                    {searchState === "loading" && (
                      <p className="text-sm">{t("access.searching")}</p>
                    )}
                    {searchState === "done" && !responses.length && (
                      <p className="text-sm">{t("access.noIntakeResults")}</p>
                    )}
                    {responses.map((row) => (
                      <button
                        type="button"
                        key={row.key}
                        className="block w-full rounded-md border p-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => chooseResponse(row)}
                      >
                        <span className="block font-medium">{row.name}</span>
                        <span className="text-muted-foreground">
                          {row.email}
                        </span>
                        {row.submittedAt && (
                          <span className="block text-xs text-muted-foreground">
                            {t("access.submittedAt")}:{" "}
                            {formatDate(row.submittedAt, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {intake && (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
                    <p className="mb-2 flex items-center gap-2 font-medium">
                      <Check className="size-4" />
                      {t("access.intakeSelected")}
                    </p>
                    <p>{intake.name}</p>
                    <p className="text-muted-foreground">{intake.email}</p>
                    <Button
                      type="button"
                      variant="link"
                      className="mt-2 h-auto p-0"
                      onClick={() => {
                        setIntake(undefined);
                        setOperations([]);
                        setSearchState("idle");
                      }}
                    >
                      {t("access.changePerson")}
                    </Button>
                  </div>
                )}
                {config.formUrl && (
                  <a
                    className="inline-flex items-center gap-2 text-sm underline"
                    href={config.formUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("access.openForm")}
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("access.manualPersonHelp")}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    {t("access.name")}
                    <Input
                      required
                      maxLength={200}
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setOperations([]);
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    {t("access.email")}
                    <Input
                      required
                      type="email"
                      maxLength={254}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setOperations([]);
                      }}
                    />
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm">
                  {t("access.manualSource")}
                  <Textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={2}
                    placeholder={t("access.manualSourcePlaceholder")}
                    value={sourceNote}
                    onChange={(event) => setSourceNote(event.target.value)}
                  />
                </label>
              </>
            )}
          </div>
        )}
        {step === 1 && (
          <div className="space-y-5">
            <p className="rounded-lg bg-muted/40 p-3 text-sm">
              <strong>{name}</strong>
              <span className="ml-2 text-muted-foreground">{email}</span>
            </p>
            <label className="grid gap-1.5 text-sm">
              {t("access.kind")}
              <select
                className={selectClass}
                aria-label={t("access.kind")}
                value={kind}
                onChange={(event) => {
                  const nextKind = event.target.value;
                  setKind(nextKind);
                  if (intake?.source === "FORMS") {
                    setTargetPositions(intakePositions(nextKind, intake));
                  }
                  setOperations([]);
                }}
              >
                {[
                  "ONBOARD",
                  "OFFBOARD",
                  "CHANGE_ACCESS",
                  "ALUMNI_TRANSITION",
                ].map((value) => (
                  <option key={value} value={value}>
                    {t(`access.kinds.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-muted-foreground">
              {t(`access.kindHelp.${kind}`)}
            </p>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t("access.departments")}
              </legend>
              <div className="flex flex-wrap gap-4">
                {config.departments.map((department) => (
                  <label
                    key={department.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={departments.includes(department.id)}
                      onChange={() => {
                        setDepartments(toggle(departments, department.id));
                        setOperations([]);
                      }}
                    />
                    {department.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t(
                  kind === "ALUMNI_TRANSITION"
                    ? "access.originPositions"
                    : "access.positions",
                )}
              </legend>
              <div className="flex flex-wrap gap-4">
                {positions
                  .filter(
                    (position) =>
                      kind !== "ALUMNI_TRANSITION" || position !== "ALUMNI",
                  )
                  .map((position) => (
                    <label
                      key={position}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={targetPositions.includes(position)}
                        onChange={() => {
                          setTargetPositions(toggle(targetPositions, position));
                          setOperations([]);
                        }}
                      />
                      {t(`access.positionsLabels.${position}`)}
                    </label>
                  ))}
              </div>
              {kind === "ALUMNI_TRANSITION" && (
                <p className="text-sm text-muted-foreground">
                  {t("access.alumniDestination")}
                </p>
              )}
            </fieldset>
            <p className="text-xs text-muted-foreground">
              {t("access.contextHelp")}
            </p>
            <label className="grid gap-1.5 text-sm">
              {t("access.reason")}
              <Textarea
                required
                minLength={5}
                maxLength={2000}
                rows={3}
                placeholder={t("access.reasonPlaceholder")}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <AccessExecutionNotice config={config} />
            <p className="text-sm">
              <strong>{name}</strong> · {t(`access.kinds.${kind}`)} ·{" "}
              {operations.length} {t("access.selectedResources")}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {t("access.recommendedResources")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOperations((current) =>
                    restoreAccessDefaults(
                      current,
                      suggested.map(defaultOperation),
                      resources,
                    ),
                  )
                }
              >
                {t("access.restoreDefaults")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("access.recommendedHelp")}
            </p>
            {suggested.length ? (
              suggested.map(card)
            ) : (
              <p className="text-sm">{t("access.noRecommendations")}</p>
            )}
            {!!additional.length && (
              <div className="rounded-lg border p-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-between whitespace-normal text-left"
                  aria-expanded={additionalOpen}
                  onClick={() => setAdditionalOpen(!additionalOpen)}
                >
                  {t("access.otherResources")}
                  <span>
                    {additional.length}
                    {selectedAdditional
                      ? ` · ${t("access.hasSelectedResources")}`
                      : ""}
                  </span>
                </Button>
                {additionalOpen && (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {t("access.otherResourcesHelp")}
                    </p>
                    {additional.map(card)}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t("access.draftHelp")}
            </p>
          </div>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-popover pt-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setStep(step - 1);
              setError("");
            }}
          >
            <ArrowLeft className="mr-2 size-4" />
            {t("access.back")}
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          disabled={
            busy ||
            (step === 0 &&
              source !== "manual" &&
              (!intake || searchState === "loading")) ||
            (step === 1 &&
              (!departments.length ||
                (kind === "ALUMNI_TRANSITION" &&
                  !hasOriginPosition(targetPositions)))) ||
            (step === 2 && !operations.length)
          }
        >
          {busy && <LoaderCircle className="mr-2 size-4 animate-spin" />}
          {t(step === 2 ? "access.saveDraft" : "access.continue")}
          {step < 2 && <ArrowRight className="ml-2 size-4" />}
        </Button>
      </div>
    </form>
  );
}
