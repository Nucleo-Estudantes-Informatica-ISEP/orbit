import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canConfirmManually,
  cleanOperation,
  intakeAccount,
  availableIntakeSources,
} from "../lib/access-lifecycle.ts";

test("real Forms responses are preferred while the manual registry remains selectable", () => {
  assert.deepEqual(
    availableIntakeSources({
      intakeSources: ["SHEETS", "FORMS"],
      intakeConfigured: true,
    }),
    ["FORMS", "SHEETS"],
  );
  assert.deepEqual(availableIntakeSources({ intakeConfigured: true }), [
    "SHEETS",
  ]);
  assert.deepEqual(
    availableIntakeSources({ intakeSources: [], intakeConfigured: false }),
    [],
  );
});

test("Forms account hints do not forge verification evidence", () => {
  const values = intakeAccount(
    { provider: "GITHUB" },
    { accounts: { githubId: "123" } },
  );
  assert.deepEqual(values, { providerUserId: "123", accountEmail: undefined });
  assert.equal("verificationNote" in values, false);
});

test("normal username fields distinguish numeric GitHub usernames from old numeric IDs", () => {
  assert.deepEqual(
    intakeAccount(
      { provider: "GITHUB" },
      { accounts: { githubUsername: "123" } },
    ),
    { accountUsername: "123", accountEmail: undefined },
  );
  assert.deepEqual(
    intakeAccount(
      { provider: "DISCORD" },
      { accounts: { discordUsername: "person.name" } },
    ),
    { accountUsername: "person.name", accountEmail: undefined },
  );
});

test("empty optional fields are omitted so validated DTOs accept an incomplete grant", () => {
  assert.deepEqual(
    cleanOperation({
      resourceId: "resource",
      action: "GRANT",
      providerUserId: "",
      accountEmail: " ",
      verificationNote: "",
    }),
    { resourceId: "resource", action: "GRANT" },
  );
});

test("automatic results cannot be completed manually unless provider requires intervention", () => {
  assert.equal(
    canConfirmManually({ automatic: true, status: "AWAITING_ACCOUNT" }),
    false,
  );
  assert.equal(
    canConfirmManually({ automatic: true, status: "FAILED" }),
    false,
  );
  assert.equal(
    canConfirmManually({ automatic: true, status: "AWAITING_MANUAL" }),
    true,
  );
  assert.equal(
    canConfirmManually({ automatic: false, status: "AWAITING_ACCOUNT" }),
    true,
  );
  assert.equal(
    canConfirmManually({ automatic: false, status: "SUCCEEDED" }),
    false,
  );
});
