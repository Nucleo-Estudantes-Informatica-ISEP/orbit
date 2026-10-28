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
  positions,
} from "@/lib/access-lifecycle";
import type {
  AccessConfiguration,
  AccessResource,
  IntakeResponse,
  LifecycleProcess,
  SelectedOperation,
} from "@/lib/access-lifecycle";
import {
  changeAccountEmail,
  changeRemoteIdentity,
  changeAccessAction,
  defaultAccessAction,
  requestPositions,
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
  const { t } = useLocale();
  const [step, setStep] = useState(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const stepBody = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stepBody.current?.scrollTo({ top: 0 });
    stepHeading.current?.focus({ preventScroll: true });
  }, [step]);
  const [source, setSource] = useState<"forms" | "manual">(
    !previous && config.intakeConfigured ? "forms" : "manual",
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
  const [operations, setOperations] = useState<SelectedOperation[]>(
    previous?.operations
      .filter((op) =>
        config.resources.some(
          (resource) =>
            resource.id === op.resourceSnapshot.id && resource.enabled,
        ),
      )
      .map((op) => ({
        resourceId: op.resourceSnapshot.id,
        action: "VERIFY",
        providerUserId: op.result?.remoteId || op.providerUserId,
        accountEmail: op.accountEmail,
      })) || [],
  );
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  const resources = config.resources.filter(
    (resource) =>
      resource.enabled &&
      (!resource.departmentIds.length ||
        resource.departmentIds.some((id) => departments.includes(id))),
  );
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
    setTargetPositions(
      response.positions.filter((position) => positions.includes(position)),
    );
    setOperations([]);
    setResponses([]);
    setSearchState("idle");
    setError("");
  }

  async function search() {
    if (query.trim().length < 3) return;
    const version = ++searchVersion.current;
    setSearchState("loading");
    setError("");
    setResponses([]);
    try {
      const rows = await api.get<IntakeResponse[]>(
        `${root}/intake?query=${encodeURIComponent(query.trim())}`,
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
        ...intakeAccount(resource, source === "forms" ? intake : undefined),
      },
      resource.provider,
      action,
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (step === 0) {
      if (source === "forms" && !intake) return;
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
          ...(source === "forms" && intake
            ? { intakeKey: intake.key }
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
    const isEmail = teamProviders.includes(resource.provider);
    const googleGrant =
      resource.provider === "GOOGLE_DRIVE" && op?.action === "GRANT";
    const identityLabel = isEmail
      ? "email"
      : resource.provider === "WHATSAPP"
        ? "phone"
        : resource.provider === "GOOGLE_DRIVE"
          ? "googlePermission"
          : resource.provider === "GITHUB"
            ? "githubId"
            : "discordId";
    const numericId = /^(DISCORD|GITHUB|GOOGLE_DRIVE)$/.test(resource.provider);
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
                    {t(`access.actions.${action}`)}
                  </option>
                ))}
              </select>
            </label>
            {googleGrant ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  {t("access.identity.googleEmail")}
                  <Input
                    type="email"
                    maxLength={200}
                    value={op.accountEmail || ""}
                    onChange={(event) =>
                      updateOperation(
                        changeAccountEmail(
                          op,
                          resource.provider,
                          event.target.value,
                        ),
                      )
                    }
                  />
                </label>
                <details
                  className="text-sm"
                  open={/^\d+$/.test(op.providerUserId || "") || undefined}
                >
                  <summary className="cursor-pointer text-muted-foreground">
                    {t("access.existingGooglePermission")}
                  </summary>
                  <label className="mt-3 grid gap-1.5">
                    {t("access.identity.googlePermission")}
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={
                        /^\d+$/.test(op.providerUserId || "")
                          ? op.providerUserId
                          : ""
                      }
                      onChange={(event) =>
                        updateOperation(
                          changeRemoteIdentity(
                            op,
                            event.target.value || op.accountEmail || "",
                          ),
                        )
                      }
                    />
                  </label>
                </details>
              </>
            ) : (
              <>
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
                    inputMode={numericId ? "numeric" : undefined}
                    pattern={numericId ? "[0-9]+" : undefined}
                    required={op.action === "REVOKE"}
                    maxLength={200}
                    value={
                      isEmail
                        ? op.accountEmail || op.providerUserId || ""
                        : op.providerUserId || ""
                    }
                    onChange={(event) =>
                      updateOperation(
                        isEmail
                          ? changeAccountEmail(
                              op,
                              resource.provider,
                              event.target.value,
                            )
                          : changeRemoteIdentity(op, event.target.value),
                      )
                    }
                  />
                </label>
                {resource.provider === "GOOGLE_DRIVE" && (
                  <details
                    className="text-sm"
                    open={Boolean(op.accountEmail) || undefined}
                  >
                    <summary className="cursor-pointer text-muted-foreground">
                      {t("access.googleConfirmationEmail")}
                    </summary>
                    <label className="mt-3 grid gap-1.5">
                      {t("access.identity.googleEmail")}
                      <Input
                        type="email"
                        maxLength={254}
                        value={op.accountEmail || ""}
                        onChange={(event) =>
                          updateOperation(
                            changeAccountEmail(
                              op,
                              resource.provider,
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </label>
                  </details>
                )}
              </>
            )}
            <label className="grid gap-1.5 text-sm">
              {t("access.verification")}
              <Textarea
                required={op.action === "REVOKE"}
                minLength={5}
                maxLength={1000}
                rows={2}
                placeholder={t(
                  `access.verificationPlaceholder.${resource.provider}`,
                )}
                value={op.verificationNote || ""}
                onChange={(event) =>
                  updateOperation({
                    ...op,
                    verificationNote: event.target.value,
                  })
                }
              />
            </label>
            {resource.automatic &&
              (!op.providerUserId?.trim() || !op.verificationNote?.trim()) && (
                <p className="text-sm text-muted-foreground">
                  {t("access.pendingIdentityHelp")}
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
            {config.intakeConfigured && (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t("access.personSource")}
              >
                {(["forms", "manual"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={source === value ? "default" : "outline"}
                    aria-pressed={source === value}
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
            )}
            {source === "forms" ? (
              <>
                <div className="space-y-2 rounded-lg border p-4">
                  <label
                    htmlFor="intake-search"
                    className="text-sm font-medium"
                  >
                    {t("access.intake")}
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
                  setKind(event.target.value);
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
                onClick={() => setOperations(suggested.map(defaultOperation))}
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
              source === "forms" &&
              (!intake || searchState === "loading")) ||
            (step === 1 && !departments.length) ||
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
