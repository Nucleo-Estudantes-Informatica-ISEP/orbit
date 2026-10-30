import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changeAccountEmail,
  changeRemoteIdentity,
  changeAccessAction,
  defaultAccessAction,
  requestPositions,
  reuseAccessOperations,
  restoreAccessDefaults,
  hasOriginPosition,
} from "../lib/access-request.ts";
import { intakePositions } from "../lib/access-lifecycle.ts";

test("welcome Forms without a declared position default to Member for onboarding", () => {
  const response = { source: "FORMS", positions: [] };
  assert.deepEqual(intakePositions("ONBOARD", response), ["MEMBER"]);
  assert.deepEqual(response.positions, []);
});

test("welcome defaults do not infer an origin position for offboarding or other processes", () => {
  for (const kind of ["OFFBOARD", "CHANGE_ACCESS", "ALUMNI_TRANSITION"]) {
    assert.deepEqual(intakePositions(kind, { source: "FORMS", positions: [] }), []);
  }
  assert.deepEqual(
    intakePositions("ONBOARD", { source: "SHEETS", positions: [] }),
    [],
  );
  assert.deepEqual(intakePositions("ONBOARD", { positions: [] }), []);
});

test("respondent positions cannot elevate welcome defaults; the manual registry preserves positions", () => {
  assert.deepEqual(
    intakePositions("ONBOARD", { source: "FORMS", positions: ["BOARD"] }),
    ["MEMBER"],
  );
  assert.deepEqual(
    intakePositions("ONBOARD", {
      source: "SHEETS",
      positions: ["MEMBER", "COORDINATOR"],
    }),
    ["MEMBER", "COORDINATOR"],
  );
  assert.deepEqual(
    intakePositions("ONBOARD", { source: "FORMS", positions: ["Unknown"] }),
    ["MEMBER"],
  );
  for (const kind of ["OFFBOARD", "CHANGE_ACCESS", "ALUMNI_TRANSITION"]) {
    assert.deepEqual(intakePositions(kind, { source: "FORMS", positions: ["PRESIDENCY"] }), []);
  }
});

test("an Alumni destination alone is not an origin position", () => {
  assert.equal(hasOriginPosition([]), false);
  assert.equal(hasOriginPosition(["ALUMNI"]), false);
  assert.equal(hasOriginPosition(["MEMBER", "ALUMNI"]), true);
});

test("reusing a Drive grant uses its normal email for every action", () => {
  const resource = { id: "drive", provider: "GOOGLE_DRIVE", enabled: true };
  const [operation] = reuseAccessOperations(
    [
      {
        resourceSnapshot: resource,
        providerUserId: "person@example.com",
        accountEmail: "person@example.com",
        verificationNote: "Previously verified",
      },
    ],
    [resource],
  );
  assert.equal(operation.action, "VERIFY");
  assert.equal(operation.providerUserId, "person@example.com");
  assert.equal(operation.accountEmail, "person@example.com");
  assert.equal(operation.verificationNote, undefined);
});

test("reuse prefers a returned Drive permission ID and excludes disabled resources", () => {
  const resource = { id: "drive", provider: "GOOGLE_DRIVE", enabled: true };
  const previous = [
    {
      resourceSnapshot: resource,
      providerUserId: "person@example.com",
      result: { remoteId: "123456" },
    },
  ];
  assert.equal(
    reuseAccessOperations(previous, [resource])[0].providerUserId,
    "123456",
  );
  assert.deepEqual(
    reuseAccessOperations(previous, [{ ...resource, enabled: false }]),
    [],
  );
});

test("restoring defaults preserves additional access and its identity and justification", () => {
  const extra = {
    resourceId: "alumni",
    action: "GRANT",
    providerUserId: "123456",
    verificationNote: "Confirmed profile",
    exceptionReason: "Explicit access request",
  };
  const restored = restoreAccessDefaults(
    [extra],
    [{ resourceId: "members", action: "GRANT" }],
    [{ id: "members", provider: "DISCORD", enabled: true }],
  );
  assert.deepEqual(restored, [
    { resourceId: "members", action: "GRANT" },
    extra,
  ]);
});

test("restoring a recommendation retains entered identity and evidence while resetting its action", () => {
  const current = {
    resourceId: "drive",
    action: "REVOKE",
    providerUserId: "123456",
    accountEmail: "person@example.com",
    verificationNote: "Verified account",
    exceptionReason: "Sensitive access approved",
  };
  const resources = [{ id: "drive", provider: "GOOGLE_DRIVE", enabled: true }];
  const defaults = [
    {
      resourceId: "drive",
      action: "GRANT",
      providerUserId: "person@example.com",
      accountEmail: "person@example.com",
    },
  ];
  const restored = restoreAccessDefaults([current], defaults, resources);
  assert.deepEqual(restored, [
    {
      ...current,
      action: "GRANT",
      providerUserId: "person@example.com",
      verificationNote: undefined,
    },
  ]);
  assert.deepEqual(
    restoreAccessDefaults(restored, defaults, resources),
    restored,
  );
});

test("a first Drive grant binds the displayed email to the verified principal", () => {
  const next = changeAccountEmail(
    {
      resourceId: "drive",
      action: "GRANT",
      providerUserId: "old@example.com",
      accountEmail: "old@example.com",
      verificationNote: "Checked old account",
    },
    "GOOGLE_DRIVE",
    "new@example.com",
  );
  assert.equal(next.providerUserId, "new@example.com");
  assert.equal(next.accountEmail, "new@example.com");
  assert.equal(next.verificationNote, undefined);
});

test("editing the Google email replaces the old principal and clears verification", () => {
  const next = changeAccountEmail(
    {
      resourceId: "drive",
      action: "GRANT",
      providerUserId: "123456",
      verificationNote: "Checked account",
    },
    "GOOGLE_DRIVE",
    "person@example.com",
  );
  assert.equal(next.providerUserId, "person@example.com");
  assert.equal(next.verificationNote, undefined);
});

test("changing a Drive grant to revocation preserves the approved email", () => {
  const next = changeAccessAction(
    {
      resourceId: "drive",
      action: "GRANT",
      providerUserId: "person@example.com",
      accountEmail: "person@example.com",
      verificationNote: "Verified Google account",
    },
    "GOOGLE_DRIVE",
    "REVOKE",
  );
  assert.equal(next.providerUserId, "person@example.com");
  assert.equal(next.accountEmail, "person@example.com");
  assert.equal(next.verificationNote, "Verified Google account");
});

test("a real Drive permission ID survives a switch between grant and revocation", () => {
  const next = changeAccessAction(
    {
      resourceId: "drive",
      action: "GRANT",
      providerUserId: "123456",
      verificationNote: "Verified permission",
    },
    "GOOGLE_DRIVE",
    "REVOKE",
  );
  assert.equal(next.providerUserId, "123456");
  assert.equal(next.verificationNote, "Verified permission");
});

test("manual team email identifies the account for both invitations and removals", () => {
  for (const provider of ["FIGMA", "CODA", "FREEDCAMP", "EMAIL"]) {
    for (const action of ["GRANT", "REVOKE"]) {
      const next = changeAccountEmail(
        { resourceId: "team", action },
        provider,
        "person@example.com",
      );
      assert.equal(next.providerUserId, "person@example.com");
      assert.equal(next.accountEmail, "person@example.com");
    }
  }
});

test("changing the target account invalidates old identity evidence without losing the resource justification", () => {
  const next = changeRemoteIdentity(
    {
      resourceId: "discord",
      action: "GRANT",
      providerUserId: "123",
      verificationNote: "Checked old account",
      exceptionReason: "Approved exception",
    },
    "456",
  );
  assert.equal(next.verificationNote, undefined);
  assert.equal(next.exceptionReason, "Approved exception");
});

test("Alumni transition grants Alumni access while revoking the previous role resources", () => {
  const policies = [
    { enabled: true, positions: ["ALUMNI"], resourceIds: ["alumni"] },
  ];
  assert.equal(
    defaultAccessAction("ALUMNI_TRANSITION", "alumni", policies),
    "GRANT",
  );
  assert.equal(
    defaultAccessAction("ALUMNI_TRANSITION", "members", policies),
    "REVOKE",
  );
  assert.deepEqual(
    requestPositions("ALUMNI_TRANSITION", ["MEMBER", "COORDINATOR"]),
    ["MEMBER", "COORDINATOR", "ALUMNI"],
  );
  assert.equal(defaultAccessAction("OFFBOARD", "alumni", policies), "REVOKE");
  assert.equal(
    defaultAccessAction("CHANGE_ACCESS", "members", policies),
    "GRANT",
  );
});

test("an Alumni transition preserves access from a policy with no position restriction", () => {
  const policies = [
    {
      enabled: true,
      departmentIds: ["it"],
      positions: [],
      resourceIds: ["shared-access"],
    },
  ];
  assert.equal(
    defaultAccessAction("ALUMNI_TRANSITION", "shared-access", policies, ["it"]),
    "GRANT",
  );
});

test("an unrestricted policy preserves shared access even when a Member-only policy also covers it", () => {
  const policies = [
    { enabled: true, positions: ["MEMBER"], resourceIds: ["shared-access"] },
    { enabled: true, positions: [], resourceIds: ["shared-access"] },
  ];
  assert.equal(
    defaultAccessAction("ALUMNI_TRANSITION", "shared-access", policies, ["it"]),
    "GRANT",
  );
});

test("an unrestricted policy from another department does not preserve access", () => {
  const policies = [
    {
      enabled: true,
      departmentIds: ["marketing"],
      positions: [],
      resourceIds: ["previous-access"],
    },
  ];
  assert.equal(
    defaultAccessAction("ALUMNI_TRANSITION", "previous-access", policies, [
      "it",
    ]),
    "REVOKE",
  );
});

test("a disabled unrestricted policy does not preserve access", () => {
  const policies = [
    { enabled: false, positions: [], resourceIds: ["previous-access"] },
  ];
  assert.equal(
    defaultAccessAction("ALUMNI_TRANSITION", "previous-access", policies, [
      "it",
    ]),
    "REVOKE",
  );
});

test("an Alumni policy from another department does not turn a revocation into a grant", () => {
  const policies = [
    {
      enabled: true,
      departmentIds: ["marketing"],
      positions: ["ALUMNI"],
      resourceIds: ["previous-access"],
    },
  ];
  assert.equal(
    defaultAccessAction("ALUMNI_TRANSITION", "previous-access", policies, [
      "it",
    ]),
    "REVOKE",
  );
});

test("a reused resolved GitHub/Discord operation displays its original username", () => {
  for (const provider of ["DISCORD", "GITHUB"]) {
    const resource = { id: "role", provider, enabled: true };
    const [operation] = reuseAccessOperations(
      [
        {
          resourceSnapshot: resource,
          providerUserId: "123456",
          result: { remoteId: "123456", accountName: "person.name" },
        },
      ],
      [resource],
    );
    assert.equal(operation.accountUsername, "person.name");
    assert.equal(operation.action, "VERIFY");
  }
});
