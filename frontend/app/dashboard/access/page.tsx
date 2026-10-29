"use client";

import { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  RefreshCw,
  ExternalLink,
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
  AccessRequestForm,
  AccessExecutionNotice,
} from "@/components/access-request-form";
import {
  AccessConfiguration,
  AccessOperation,
  LifecycleProcess,
  canConfirmManually,
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
  const [previousRequest, setPreviousRequest] = useState<LifecycleProcess>();
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
    if (remoteQuery && remoteQuery.trim().length < 3) {
      setProcesses([]);
      setError(t("access.remoteSearchMinimum"));
      return;
    }
    const params = new URLSearchParams({ offset: String(offset) });
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    if (remoteQuery) params.set("providerUserId", remoteQuery.trim());
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
    setPreviousRequest(previous);
    setCreating(true);
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
      {config && <AccessExecutionNotice config={config} />}
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
        <DialogContent className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("access.new")}</DialogTitle>
          </DialogHeader>
          {creating && config && (
            <AccessRequestForm
              config={config}
              previous={previousRequest}
              onCreate={async (payload) => {
                const result = await api.post<LifecycleProcess>(
                  `${root}/processes`,
                  payload,
                );
                setCreating(false);
                setSelected(result);
                await load();
              }}
            />
          )}
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
                {t("access.source")}:{" "}
                {t(`access.sourceType.${selected.source.type}`)}{" "}
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
                    {t("access.remoteId")}:{" "}
                    {op.result?.accountName ||
                      op.accountEmail ||
                      op.providerUserId ||
                      "—"}{" "}
                    {op.accountEmail &&
                    op.result?.accountName &&
                    op.accountEmail !== op.result.accountName
                      ? ` · ${op.accountEmail}`
                      : ""}
                  </p>
                  {["DISCORD", "GITHUB"].includes(op.provider) &&
                    op.providerUserId &&
                    /^\d+$/.test(op.providerUserId) &&
                    op.result?.accountName && (
                      <p className="break-all text-sm text-muted-foreground">
                        {t("access.resolvedAccountId")}: {op.providerUserId}
                      </p>
                    )}
                  {op.result?.identitySource && (
                    <p className="text-sm text-muted-foreground">
                      {t(`access.identitySource.${op.result.identitySource}`)}
                    </p>
                  )}
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
