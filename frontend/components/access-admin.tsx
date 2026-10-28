"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import {
  AccessConfiguration,
  AccessPolicy,
  AccessResource,
  Provider,
  positions,
  providers,
  resourceTypes,
} from "@/lib/access-lifecycle";
import { toast } from "sonner";

type ResourceForm = Omit<AccessResource, "id" | "version">;
type PolicyForm = Omit<AccessPolicy, "id" | "version">;
const emptyResource: ResourceForm = {
  name: "",
  provider: "FIGMA",
  remoteId: "",
  containerId: "",
  resourceType: "FIGMA_TEAM",
  automatic: false,
  sensitive: false,
  enabled: true,
  departmentIds: [],
  instructions: "",
  adminUrl: "",
};
const emptyPolicy: PolicyForm = {
  name: "",
  departmentIds: [],
  positions: [],
  resourceIds: [],
  enabled: true,
};
const selectClass = "h-10 rounded-md border bg-background px-3 text-sm";

export function AccessAdmin({
  config,
  reload,
}: {
  config: AccessConfiguration;
  reload: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [editingResource, setEditingResource] = useState<AccessResource | null>(
    null,
  );
  const [editingPolicy, setEditingPolicy] = useState<AccessPolicy | null>(null);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [resource, setResource] = useState<ResourceForm>({ ...emptyResource });
  const [policy, setPolicy] = useState<PolicyForm>({ ...emptyPolicy });
  const [busy, setBusy] = useState(false);
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];

  async function save(type: "resources" | "policies") {
    setBusy(true);
    try {
      const current = type === "resources" ? editingResource : editingPolicy;
      const body =
        type === "resources"
          ? {
              ...resource,
              containerId: resource.containerId || (current ? null : undefined),
              adminUrl: resource.adminUrl || (current ? null : undefined),
            }
          : policy;
      if (current)
        await api.put(`/access-lifecycle/${type}/${current.id}`, {
          ...body,
          version: current.version,
        });
      else await api.post(`/access-lifecycle/${type}`, body);
      setResourceOpen(false);
      setPolicyOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("access.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <h2 className="font-semibold">{t("access.settings")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("access.settingsHelp")}
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingResource(null);
              setResource({ ...emptyResource });
              setResourceOpen(true);
            }}
          >
            {t("access.addResource")}
          </Button>
          {config.resources.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm"
              onClick={() => {
                setEditingResource(item);
                setResource(
                  Object.fromEntries(
                    Object.keys(emptyResource).map((key) => [
                      key,
                      item[key as keyof AccessResource],
                    ]),
                  ) as ResourceForm,
                );
                setResourceOpen(true);
              }}
            >
              <span>
                {item.name} · {item.provider}
              </span>
              <span>
                v{item.version} ·{" "}
                {item.enabled ? t("access.enabled") : t("access.disabled")}
              </span>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingPolicy(null);
              setPolicy({ ...emptyPolicy });
              setPolicyOpen(true);
            }}
          >
            {t("access.addPolicy")}
          </Button>
          {config.policies.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm"
              onClick={() => {
                setEditingPolicy(item);
                setPolicy(
                  Object.fromEntries(
                    Object.keys(emptyPolicy).map((key) => [
                      key,
                      item[key as keyof AccessPolicy],
                    ]),
                  ) as PolicyForm,
                );
                setPolicyOpen(true);
              }}
            >
              <span>{item.name}</span>
              <span>
                v{item.version} ·{" "}
                {item.enabled ? t("access.enabled") : t("access.disabled")}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={resourceOpen} onOpenChange={setResourceOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("access.addResource")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save("resources");
            }}
          >
            <label className="grid gap-2 text-sm">
              {t("access.name")}
              <Input
                required
                value={resource.name}
                onChange={(event) =>
                  setResource({ ...resource, name: event.target.value })
                }
              />
            </label>
            <label className="grid gap-2 text-sm">
              {t("access.provider")}
              <select
                className={selectClass}
                value={resource.provider}
                onChange={(event) => {
                  const provider = event.target.value as Provider;
                  setResource({
                    ...resource,
                    provider,
                    resourceType: resourceTypes[provider][0],
                    automatic: false,
                  });
                }}
              >
                {providers.map((provider) => (
                  <option key={provider}>{provider}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              {t("access.resourceType")}
              <select
                className={selectClass}
                value={resource.resourceType}
                onChange={(event) =>
                  setResource({ ...resource, resourceType: event.target.value })
                }
              >
                {resourceTypes[resource.provider].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              {t("access.remoteResourceId")}
              <Input
                required
                value={resource.remoteId}
                onChange={(event) =>
                  setResource({ ...resource, remoteId: event.target.value })
                }
              />
            </label>
            <label className="grid gap-2 text-sm">
              {t("access.containerId")}
              <Input
                value={resource.containerId || ""}
                onChange={(event) =>
                  setResource({ ...resource, containerId: event.target.value })
                }
              />
            </label>
            <label className="grid gap-2 text-sm">
              {t("access.adminUrl")}
              <Input
                type="url"
                pattern="https://.*"
                value={resource.adminUrl || ""}
                onChange={(event) =>
                  setResource({ ...resource, adminUrl: event.target.value })
                }
              />
            </label>
            <label className="grid gap-2 text-sm">
              {t("access.instructions")}
              <Textarea
                value={resource.instructions}
                onChange={(event) =>
                  setResource({ ...resource, instructions: event.target.value })
                }
              />
            </label>
            <div className="flex flex-wrap gap-4">
              {(["enabled", "sensitive", "automatic"] as const).map((field) => (
                <label className="flex items-center gap-2 text-sm" key={field}>
                  <input
                    type="checkbox"
                    checked={resource[field]}
                    disabled={
                      field === "automatic" &&
                      !["DISCORD", "GITHUB", "GOOGLE_DRIVE"].includes(
                        resource.provider,
                      )
                    }
                    onChange={(event) =>
                      setResource({
                        ...resource,
                        [field]: event.target.checked,
                      })
                    }
                  />
                  {t(`access.${field}`)}
                </label>
              ))}
            </div>
            <fieldset>
              <legend className="mb-2 text-sm">
                {t("access.departments")} · {t("access.emptyMeansAll")}
              </legend>
              {config.departments.map((department) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={department.id}
                >
                  <input
                    type="checkbox"
                    checked={resource.departmentIds.includes(department.id)}
                    onChange={() =>
                      setResource({
                        ...resource,
                        departmentIds: toggle(
                          resource.departmentIds,
                          department.id,
                        ),
                      })
                    }
                  />
                  {department.name}
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={busy}>
              {t("access.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("access.addPolicy")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save("policies");
            }}
          >
            <label className="grid gap-2 text-sm">
              {t("access.name")}
              <Input
                required
                value={policy.name}
                onChange={(event) =>
                  setPolicy({ ...policy, name: event.target.value })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policy.enabled}
                onChange={(event) =>
                  setPolicy({ ...policy, enabled: event.target.checked })
                }
              />
              {t("access.enabled")}
            </label>
            <fieldset>
              <legend className="mb-2 text-sm">
                {t("access.departments")} · {t("access.emptyMeansAll")}
              </legend>
              {config.departments.map((department) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={department.id}
                >
                  <input
                    type="checkbox"
                    checked={policy.departmentIds.includes(department.id)}
                    onChange={() =>
                      setPolicy({
                        ...policy,
                        departmentIds: toggle(
                          policy.departmentIds,
                          department.id,
                        ),
                      })
                    }
                  />
                  {department.name}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm">
                {t("access.positions")} · {t("access.emptyMeansAll")}
              </legend>
              {positions.map((position) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={position}
                >
                  <input
                    type="checkbox"
                    checked={policy.positions.includes(position)}
                    onChange={() =>
                      setPolicy({
                        ...policy,
                        positions: toggle(policy.positions, position),
                      })
                    }
                  />
                  {t(`access.positionsLabels.${position}`)}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm">{t("access.resources")}</legend>
              {config.resources.map((item) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={item.id}
                >
                  <input
                    type="checkbox"
                    checked={policy.resourceIds.includes(item.id)}
                    onChange={() =>
                      setPolicy({
                        ...policy,
                        resourceIds: toggle(policy.resourceIds, item.id),
                      })
                    }
                  />
                  {item.name}
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={busy || !policy.resourceIds.length}>
              {t("access.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
