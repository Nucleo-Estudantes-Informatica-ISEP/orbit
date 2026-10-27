import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canConfirmManually,
  cleanOperation,
  intakeAccount,
} from "../lib/access-lifecycle.ts";

test("Forms account hints do not forge verification evidence", () => {
  const values = intakeAccount(
    { provider: "GITHUB" },
    { accounts: { githubId: "123" } },
  );
  assert.deepEqual(values, { providerUserId: "123", accountEmail: undefined });
  assert.equal("verificationNote" in values, false);
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
