import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function request(path, options = {}) {
  return {
    url: new URL(path, "https://orbit.test").href,
    method: "GET",
    mode: "cors",
    destination: "",
    ...options,
    headers: new Headers(options.headers),
  };
}

function loadWorker({ fetchImpl, cachedRoot = new Response("offline home") } = {}) {
  const handlers = {};
  const deleted = [];
  const puts = [];
  let claimed = false;
  const cache = {
    add: async () => {},
    match: async () => undefined,
    put: async (assetRequest) => puts.push(assetRequest.url),
  };

  vm.runInNewContext(source, {
    URL,
    Response,
    fetch: fetchImpl ?? (async () => new Response("network")),
    caches: {
      open: async () => cache,
      keys: async () => ["orbit-pwa-v1", "orbit-pwa-v2"],
      delete: async (key) => {
        deleted.push(key);
        return true;
      },
      match: async (path) => (path === "/" ? cachedRoot : undefined),
    },
    self: {
      location: { origin: "https://orbit.test" },
      addEventListener: (type, handler) => {
        handlers[type] = handler;
      },
      skipWaiting: async () => {},
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
    },
  });

  return {
    handlers,
    deleted,
    puts,
    get claimed() {
      return claimed;
    },
  };
}

function dispatchFetch(worker, assetRequest) {
  let response;
  worker.handlers.fetch({
    request: assetRequest,
    respondWith: (value) => {
      response = Promise.resolve(value);
    },
  });
  return response;
}

test("service worker", async (t) => {
  await t.test("falls back only for the offline start URL", async () => {
    const worker = loadWorker({
      fetchImpl: async () => {
        throw new TypeError("offline");
      },
    });

    const rootResponse = await dispatchFetch(
      worker,
      request("/", { mode: "navigate", destination: "document" }),
    );
    assert.equal(await rootResponse.text(), "offline home");
    assert.equal(
      dispatchFetch(
        worker,
        request("/dashboard/tasks", {
          mode: "navigate",
          destination: "document",
        }),
      ),
      undefined,
    );
  });

  await t.test("never caches protected assets", () => {
    const worker = loadWorker();
    for (const assetRequest of [
      request("/api/private.png", { destination: "image" }),
      request("/files/private.png", { destination: "image" }),
      request("/avatar.png", {
        destination: "image",
        headers: { authorization: "Bearer secret" },
      }),
    ]) {
      assert.equal(dispatchFetch(worker, assetRequest), undefined);
    }
  });

  await t.test("caches same-origin public assets", async () => {
    const worker = loadWorker();
    const assetRequest = request("/_next/static/app.js", {
      destination: "script",
    });

    const response = await dispatchFetch(worker, assetRequest);
    assert.equal(await response.text(), "network");
    assert.deepEqual(worker.puts, [assetRequest.url]);
  });

  await t.test("removes stale caches before claiming clients", async () => {
    const worker = loadWorker();
    let activation;
    worker.handlers.activate({
      waitUntil: (value) => {
        activation = value;
      },
    });

    await activation;
    assert.deepEqual(worker.deleted, ["orbit-pwa-v1"]);
    assert.equal(worker.claimed, true);
  });
});
