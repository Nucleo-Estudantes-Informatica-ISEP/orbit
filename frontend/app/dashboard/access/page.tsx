"use client";

import { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  RefreshCw,
  ExternalLink,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { AccessAdmin } from "@/components/access-admin";
import {
  AccessConfiguration,
  AccessOperation,
  IntakeResponse,
  LifecycleProcess,
  SelectedOperation,
  canConfirmManually,
  cleanOperation,
  intakeAccount,
  positions,
} from "@/lib/access-lifecycle";
import { toast } from "sonner";

const root = "/access-lifecycle";
const selectClass = "h-10 rounded-md border bg-background px-3 text-sm";

export default function AccessPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [config, setConfig] = useState<AccessConfiguration | null>(null);
  const [processes, setProcesses] = useState<LifecycleProcess[]>([]);
  const [selected, setSelected] = useState<LifecycleProcess | null>(null);
  const [inventory, setInventory] = useState<
    {
      operationId: string;
      resource: string;
      observation?: { detail: string };
      discovered?: {
        remoteId: string;
        name: string;
        administrative: boolean;
      }[];
      error?: string;
    }[]
  >([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [remoteQuery, setRemoteQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [kind, setKind] = useState("ONBOARD");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [targetPositions, setTargetPositions] = useState<string[]>(["MEMBER"]);
  const [reason, setReason] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [intakeQuery, setIntakeQuery] = useState("");
  const [responses, setResponses] = useState<IntakeResponse[]>([]);
  const [intake, setIntake] = useState<IntakeResponse>();
  const [operations, setOperations] = useState<SelectedOperation[]>([]);
  const [decisionNote, setDecisionNote] = useState("");
  const [confirmation, setConfirmation] = useState<AccessOperation | null>(
    null,
  );
  const [evidence, setEvidence] = useState("");
  const [outcome, setOutcome] = useState("SUCCEEDED");
  const can = (permission: string) =>
    config?.permissions.includes(permission) || false;

  const load = useCallback(async () => {
    if (!user?.permissions?.includes("ACCESS_READ")) return;
    const params = new URLSearchParams({ offset: String(offset) });
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    if (remoteQuery) params.set("providerUserId", remoteQuery);
    try {
      const [configuration, items] = await Promise.all([
        api.get<AccessConfiguration>(`${root}/configuration`),
        api.get<LifecycleProcess[]>(`${root}/processes?${params}`),
      ]);
      setConfig(configuration);
      setProcesses(items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("access.failed"));
    }
  }, [user, query, status, remoteQuery, offset, t]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("access.failed"));
    } finally {
      setBusy(false);
    }
  }
  const update = async (path: string, body: unknown = {}) => {
    const result = await api.post<LifecycleProcess>(
      `${root}/processes/${selected!.id}/${path}`,
      body,
    );
    setSelected(result);
  };

  function start(previous?: LifecycleProcess) {
    setKind(previous ? "CHANGE_ACCESS" : "ONBOARD");
    setName(previous?.targetName || "");
    setEmail(previous?.targetEmail || "");
    setDepartments(previous?.targetDepartmentIds || []);
    setTargetPositions(previous?.targetPositions || ["MEMBER"]);
    setReason("");
    setIntake(undefined);
    setResponses([]);
    setIntakeQuery("");
    setOperations(
      previous?.operations
        .filter((op) =>
          config?.resources.some(
            (resource) =>
              resource.id === op.resourceSnapshot.id && resource.enabled,
          ),
        )
        .map((op) => ({
          resourceId: op.resourceSnapshot.id,
          action: "VERIFY" as const,
          providerUserId: op.result?.remoteId || op.providerUserId,
          accountEmail: op.accountEmail,
        })) || [],
    );
    setSourceNote(previous ? `${t("access.reused")} ${previous.id}` : "");
    setCreating(true);
  }

  function chooseResponse(response: IntakeResponse) {
    setIntake(response);
    setName(response.name);
    setEmail(response.email);
    setDepartments(response.departmentIds);
    setTargetPositions(
      response.positions.filter((position) => positions.includes(position)),
    );
    setOperations([]);
    setResponses([]);
  }

  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  const changeOperation = (
    resourceId: string,
    value: Partial<SelectedOperation>,
  ) =>
    setOperations((items) =>
      items.map((op) =>
        op.resourceId === resourceId ? { ...op, ...value } : op,
      ),
    );

  async function create() {
    const result = await api.post<LifecycleProcess>(`${root}/processes`, {
      kind,
      targetName: name,
      targetEmail: email,
      targetDepartmentIds: departments,
      targetPositions,
      reason,
      ...(intake ? { intakeKey: intake.key } : { sourceNote }),
      selectedOperations: operations.map(cleanOperation),
    });
    setCreating(false);
    setSelected(result);
  }

  if (!user?.permissions?.includes("ACCESS_READ"))
    return <p className="p-8">{t("access.noPermission")}</p>;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <KeyRound className="h-6 w-6" />
            {t("access.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("access.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void run(load)}
            aria-label={t("access.refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {can("ACCESS_MANAGE") && can("ACCESS_ALL_DEPARTMENTS") && (
            <Button variant="outline" onClick={() => setAdmin(!admin)}>
              <Settings className="mr-2 h-4 w-4" />
              {t("access.settings")}
            </Button>
          )}
          {can("ACCESS_CREATE") && (
            <Button onClick={() => start()}>
              <Plus className="mr-2 h-4 w-4" />
              {t("access.new")}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-4 text-destructive"
        >
          {error}
        </p>
      )}
      {admin && config && <AccessAdmin config={config} reload={load} />}
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        {t("access.partialInventory")}
      </div>
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label={t("access.search")}
          placeholder={t("access.search")}
          className="max-w-sm"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOffset(0);
          }}
        />
        <Input
          aria-label={t("access.remoteId")}
          placeholder={t("access.remoteId")}
          className="max-w-xs"
          value={remoteQuery}
          onChange={(event) => {
            setRemoteQuery(event.target.value);
            setOffset(0);
          }}
        />
        <select
          aria-label={t("access.status")}
          className={selectClass}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setOffset(0);
          }}
        >
          <option value="">{t("access.allStatuses")}</option>
          {[
            "DRAFT",
            "PENDING_APPROVAL",
            "APPROVED",
            "REJECTED",
            "COMPLETED",
            "CANCELLED",
          ].map((value) => (
            <option key={value} value={value}>
              {t(`access.states.${value}`)}
            </option>
          ))}
        </select>
      </div>
      {!config && !error && <p role="status">{t("access.loading")}</p>}
      <div className="space-y-3">
        {processes.map((process) => (
          <button
            key={process.id}
            onClick={() => {
              setSelected(process);
              setDecisionNote("");
              setInventory([]);
            }}
            className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
          >
            <div>
              <p className="font-medium">{process.targetName}</p>
              <p className="text-sm text-muted-foreground">
                {process.targetEmail} · {t(`access.kinds.${process.kind}`)}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span>
                {
                  process.operations.filter((op) => op.status === "SUCCEEDED")
                    .length
                }
                /{process.operations.length}
              </span>
              <Badge variant="outline">
                {t(`access.states.${process.status}`)}
              </Badge>
            </div>
          </button>
        ))}
      </div>
      {config && !processes.length && (
        <p className="py-12 text-center text-muted-foreground">
          {t("access.empty")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          {t("access.previous")}
        </Button>
        <Button
          variant="outline"
          disabled={processes.length < 50}
          onClick={() => setOffset(offset + 50)}
        >
          {t("access.next")}
        </Button>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("access.new")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void run(create);
            }}
          >
            {config?.formUrl && (
              <a
                href={config.formUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm underline"
              >
                {t("access.openForm")}
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {config?.intakeConfigured && (
              <div className="space-y-2 rounded-lg border p-3">
                <label className="text-sm font-medium" htmlFor="intake-search">
                  {t("access.intake")}
                </label>
                <div className="flex gap-2">
                  <Input
                    id="intake-search"
                    value={intakeQuery}
                    onChange={(event) => setIntakeQuery(event.target.value)}
                    placeholder={t("access.search")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || intakeQuery.trim().length < 3}
                    onClick={() =>
                      void run(async () => {
                        setResponses(
                          await api.get<IntakeResponse[]>(
                            `${root}/intake?query=${encodeURIComponent(intakeQuery)}`,
                          ),
                        );
                      })
                    }
                  >
                    <Search className="h-4 w-4" />
                    <span className="sr-only">{t("access.search")}</span>
                  </Button>
                </div>
                {responses.map((row) => (
                  <Button
                    type="button"
                    variant="outline"
                    key={row.key}
                    onClick={() => chooseResponse(row)}
                  >
                    {row.name} · {row.email}
                  </Button>
                ))}
                {intake && (
                  <p className="text-sm">
                    {t("access.intakeSelected")} {intake.name}
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setIntake(undefined)}
                    >
                      {t("access.clear")}
                    </Button>
                  </p>
                )}
              </div>
            )}
            <label className="grid gap-2 text-sm">
              {t("access.kind")}
              <select
                className={selectClass}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                {t("access.name")}
                <Input
                  required
                  maxLength={200}
                  value={name}
                  readOnly={Boolean(intake)}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm">
                {t("access.email")}
                <Input
                  required
                  type="email"
                  value={email}
                  readOnly={Boolean(intake)}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            </div>
            {!intake && (
              <label className="grid gap-2 text-sm">
                {t("access.source")}
                <Textarea
                  required
                  minLength={5}
                  value={sourceNote}
                  onChange={(event) => setSourceNote(event.target.value)}
                />
              </label>
            )}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t("access.departments")}
              </legend>
              <div className="flex flex-wrap gap-4">
                {config?.departments.map((department) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    key={department.id}
                  >
                    <input
                      type="checkbox"
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
                {t("access.positions")}
              </legend>
              <div className="flex flex-wrap gap-4">
                {positions.map((position) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    key={position}
                  >
                    <input
                      type="checkbox"
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
            </fieldset>
            <label className="grid gap-2 text-sm">
              {t("access.reason")}
              <Textarea
                required
                minLength={5}
                maxLength={2000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !departments.length}
              onClick={() =>
                void run(async () => {
                  const preview = await api.post<{
                    resources: AccessConfiguration["resources"];
                  }>(`${root}/preview`, {
                    departmentIds: departments,
                    positions: targetPositions,
                  });
                  setOperations(
                    preview.resources.map((resource) => ({
                      resourceId: resource.id,
                      action:
                        kind === "OFFBOARD" || kind === "ALUMNI_TRANSITION"
                          ? "REVOKE"
                          : "GRANT",
                      ...intakeAccount(resource, intake),
                    })),
                  );
                })
              }
            >
              {t("access.defaults")}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("access.identityHelp")}
            </p>
            <fieldset className="space-y-3">
              <legend className="mb-3 font-medium">
                {t("access.resources")}
              </legend>
              {config?.resources
                .filter(
                  (resource) =>
                    resource.enabled &&
                    (!resource.departmentIds.length ||
                      resource.departmentIds.some((id) =>
                        departments.includes(id),
                      )),
                )
                .map((resource) => {
                  const op = operations.find(
                    (value) => value.resourceId === resource.id,
                  );
                  return (
                    <div className="rounded-lg border p-3" key={resource.id}>
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={Boolean(op)}
                          onChange={() =>
                            setOperations((items) =>
                              op
                                ? items.filter(
                                    (value) => value.resourceId !== resource.id,
                                  )
                                : [
                                    ...items,
                                    {
                                      resourceId: resource.id,
                                      action:
                                        kind === "OFFBOARD"
                                          ? "REVOKE"
                                          : "GRANT",
                                      ...intakeAccount(resource, intake),
                                    },
                                  ],
                            )
                          }
                        />
                        {resource.name}
                        <Badge variant="outline">
                          {resource.automatic
                            ? t("access.automatic")
                            : t("access.manual")}
                        </Badge>
                        {resource.sensitive && (
                          <Badge variant="destructive">
                            {t("access.sensitive")}
                          </Badge>
                        )}
                      </label>
                      {op && (
                        <div className="mt-3 space-y-3">
                          <p className="text-sm text-muted-foreground">
                            {resource.instructions}
                          </p>
                          <label className="grid gap-1 text-sm">
                            {t("access.action")}
                            <select
                              className={selectClass}
                              value={op.action}
                              onChange={(event) =>
                                changeOperation(resource.id, {
                                  action: event.target
                                    .value as SelectedOperation["action"],
                                })
                              }
                            >
                              {(kind === "OFFBOARD"
                                ? ["REVOKE", "VERIFY"]
                                : kind === "ONBOARD"
                                  ? ["GRANT", "VERIFY"]
                                  : ["GRANT", "REVOKE", "VERIFY"]
                              ).map((value) => (
                                <option key={value} value={value}>
                                  {t(`access.actions.${value}`)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1 text-sm">
                              {t("access.remoteId")}
                              <Input
                                required={op.action === "REVOKE"}
                                maxLength={200}
                                value={op.providerUserId || ""}
                                onChange={(event) =>
                                  changeOperation(resource.id, {
                                    providerUserId: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="grid gap-1 text-sm">
                              {t("access.accountEmail")}
                              <Input
                                type="email"
                                value={op.accountEmail || ""}
                                onChange={(event) =>
                                  changeOperation(resource.id, {
                                    accountEmail: event.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                          <label className="grid gap-1 text-sm">
                            {t("access.verification")}
                            <Textarea
                              minLength={5}
                              required={op.action === "REVOKE"}
                              value={op.verificationNote || ""}
                              onChange={(event) =>
                                changeOperation(resource.id, {
                                  verificationNote: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="grid gap-1 text-sm">
                            {t("access.exception")}
                            <Textarea
                              minLength={5}
                              required={resource.sensitive}
                              value={op.exceptionReason || ""}
                              onChange={(event) =>
                                changeOperation(resource.id, {
                                  exceptionReason: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
            </fieldset>
            {!config?.resources.length && (
              <p className="text-sm text-muted-foreground">
                {t("access.noResources")}
              </p>
            )}
            <Button
              disabled={busy || !operations.length || !departments.length}
              type="submit"
            >
              {t("access.saveDraft")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.targetName} ·{" "}
              {selected && t(`access.kinds.${selected.kind}`)}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <p>{selected.targetEmail}</p>
              <Badge variant="outline">
                {t(`access.states.${selected.status}`)}
              </Badge>
              <p className="whitespace-pre-wrap text-sm">{selected.reason}</p>
              <p className="text-sm text-muted-foreground">
                {t("access.source")}: {selected.source.type}{" "}
                {selected.source.note}
              </p>
              <p className="text-sm">
                {selected.targetDepartmentIds
                  .map(
                    (id) =>
                      config?.departments.find(
                        (department) => department.id === id,
                      )?.name || id,
                  )
                  .join(", ")}{" "}
                ·{" "}
                {selected.targetPositions
                  .map((position) => t(`access.positionsLabels.${position}`))
                  .join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("access.immutable")}
              </p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setInventory(
                      await api.get<typeof inventory>(
                        `${root}/processes/${selected.id}/inventory`,
                      ),
                    );
                  })
                }
              >
                {t("access.inventory")}
              </Button>
              {inventory.map((item) => (
                <div
                  key={item.operationId}
                  className="rounded-lg border p-3 text-sm"
                >
                  <p className="font-medium">{item.resource}</p>
                  <p>{item.error || item.observation?.detail}</p>
                  {item.discovered?.map((role) => (
                    <p className="mt-1" key={role.remoteId}>
                      {role.name} · {role.remoteId}{" "}
                      {role.administrative ? `· ${t("access.sensitive")}` : ""}
                    </p>
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {selected.requestedByUserId === user.id &&
                  selected.status === "DRAFT" &&
                  can("ACCESS_CREATE") && (
                    <Button
                      disabled={busy}
                      onClick={() => void run(() => update("submit"))}
                    >
                      {t("access.submit")}
                    </Button>
                  )}
                {selected.requestedByUserId === user.id &&
                  ["DRAFT", "PENDING_APPROVAL"].includes(selected.status) &&
                  can("ACCESS_CREATE") && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run(() => update("cancel"))}
                    >
                      {t("access.cancel")}
                    </Button>
                  )}
                {can("ACCESS_CREATE") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const previous = selected;
                      setSelected(null);
                      start(previous);
                    }}
                  >
                    {t("access.reuse")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setSelected(
                        await api.get<LifecycleProcess>(
                          `${root}/processes/${selected.id}`,
                        ),
                      );
                    })
                  }
                >
                  {t("access.refresh")}
                </Button>
              </div>
              {can("ACCESS_APPROVE") &&
                selected.status === "PENDING_APPROVAL" &&
                selected.requestedByUserId !== user.id && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <label className="grid gap-2 text-sm">
                      {t("access.decisionNote")}
                      <Textarea
                        value={decisionNote}
                        onChange={(event) =>
                          setDecisionNote(event.target.value)
                        }
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button
                        disabled={busy || decisionNote.trim().length < 5}
                        onClick={() =>
                          void run(() =>
                            update("decision", {
                              approved: true,
                              note: decisionNote,
                            }),
                          )
                        }
                      >
                        {t("access.approve")}
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={busy || decisionNote.trim().length < 5}
                        onClick={() =>
                          void run(() =>
                            update("decision", {
                              approved: false,
                              note: decisionNote,
                            }),
                          )
                        }
                      >
                        {t("access.reject")}
                      </Button>
                    </div>
                  </div>
                )}
              {selected.approvals.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-lg bg-muted/40 p-3 text-sm"
                >
                  <p>
                    {approval.approved
                      ? t("access.approve")
                      : t("access.reject")}{" "}
                    · {approval.decidedById} ·{" "}
                    {new Date(approval.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{approval.note}</p>
                </div>
              ))}
              {selected.operations.map((op) => (
                <div className="space-y-2 rounded-lg border p-4" key={op.id}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="font-medium">
                      {op.resourceSnapshot.name} ·{" "}
                      {t(`access.actions.${op.action}`)}
                    </h3>
                    <Badge variant="outline">
                      {t(`access.states.${op.status}`)}
                    </Badge>
                  </div>
                  <p className="text-sm">{op.resourceSnapshot.instructions}</p>
                  <p className="break-all text-sm text-muted-foreground">
                    {t("access.remoteId")}: {op.providerUserId || "—"} ·{" "}
                    {op.accountEmail}
                  </p>
                  {op.verificationNote && (
                    <p className="text-sm">
                      {t("access.verification")}: {op.verificationNote}
                    </p>
                  )}
                  {op.exceptionReason && (
                    <p className="text-sm">
                      {t("access.exception")}: {op.exceptionReason}
                    </p>
                  )}
                  {op.result?.detail && (
                    <p className="text-sm">{op.result.detail}</p>
                  )}
                  {op.lastError && (
                    <p className="text-sm text-destructive">{op.lastError}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {op.automatic &&
                      can("ACCESS_EXECUTE") &&
                      ["APPROVED", "COMPLETED"].includes(selected.status) && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const result = await api.post<{ detail: string }>(
                                `${root}/processes/${selected.id}/operations/${op.id}/reconcile`,
                                {},
                              );
                              toast.info(result.detail);
                              setSelected(
                                await api.get<LifecycleProcess>(
                                  `${root}/processes/${selected.id}`,
                                ),
                              );
                            })
                          }
                        >
                          {t("access.reconcile")}
                        </Button>
                      )}
                    {selected.status === "APPROVED" &&
                      can("ACCESS_EXECUTE") && (
                        <>
                          {op.resourceSnapshot.adminUrl && (
                            <Button variant="outline" asChild>
                              <a
                                href={op.resourceSnapshot.adminUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t("access.openService")}
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {canConfirmManually(op) && (
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setConfirmation(op);
                                setEvidence("");
                                setOutcome("SUCCEEDED");
                              }}
                            >
                              {t("access.confirm")}
                            </Button>
                          )}
                          {op.automatic &&
                            [
                              "FAILED",
                              "AWAITING_ACCOUNT",
                              "AWAITING_MANUAL",
                            ].includes(op.status) && (
                              <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  void run(() =>
                                    update(`operations/${op.id}/retry`),
                                  )
                                }
                              >
                                {t("access.retry")}
                              </Button>
                            )}
                        </>
                      )}
                  </div>
                  {op.evidence.map((item) => (
                    <div
                      className="rounded-md bg-muted/40 p-2 text-xs"
                      key={item.id}
                    >
                      <p>
                        {t(`access.states.${item.outcome}`)} ·{" "}
                        {item.performedById} ·{" "}
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{item.note}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("access.confirm")} · {confirmation?.resourceSnapshot.name}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await update(`operations/${confirmation!.id}/confirm-manual`, {
                  outcome,
                  note: evidence,
                });
                setConfirmation(null);
              });
            }}
          >
            <p className="text-sm text-muted-foreground">
              {t("access.evidenceHelp")}
            </p>
            <label className="grid gap-2 text-sm">
              {t("access.status")}
              <select
                className={selectClass}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
              >
                {[
                  "SUCCEEDED",
                  ...(confirmation?.action === "GRANT"
                    ? ["AWAITING_ACCOUNT"]
                    : []),
                  "FAILED",
                  "SKIPPED",
                ].map((value) => (
                  <option key={value} value={value}>
                    {t(`access.states.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              {t("access.evidence")}
              <Textarea
                required
                minLength={5}
                maxLength={2000}
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
              />
            </label>
            <Button disabled={busy} type="submit">
              {t("access.saveEvidence")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
