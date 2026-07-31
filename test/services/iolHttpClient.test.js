const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const nock = require("nock");
const { IolHttpClient } = require("../../src/services/iolHttpClient");

const BASE_URL = "https://fake-iol.test/api/v2";

beforeEach(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
  nock.enableNetConnect();
});

function makeLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

function makeFakeAuthService(overrides = {}) {
  const calls = { getAccessToken: 0, invalidateAccessToken: 0, refreshAccessToken: 0, authenticate: 0 };
  return {
    calls,
    getAccessToken: async () => {
      calls.getAccessToken += 1;
      return "token-1";
    },
    invalidateAccessToken: () => {
      calls.invalidateAccessToken += 1;
    },
    refreshAccessToken: async () => {
      calls.refreshAccessToken += 1;
    },
    authenticate: async () => {
      calls.authenticate += 1;
    },
    ...overrides
  };
}

test("get() attaches a Bearer token from the authService and returns response data", async () => {
  const authService = makeFakeAuthService();
  const scope = nock(BASE_URL, { reqheaders: { authorization: "Bearer token-1" } })
    .get("/Titulos/GGAL")
    .reply(200, { simbolo: "GGAL" });

  const client = new IolHttpClient({ authService, baseUrl: BASE_URL, timeoutMs: 5000, retries: 3, logger: makeLogger() });
  const data = await client.get("/Titulos/GGAL");

  assert.deepEqual(data, { simbolo: "GGAL" });
  assert.ok(scope.isDone());
});

test("on a 401, invalidates the token, refreshes, and retries the request once", async () => {
  const authService = makeFakeAuthService();
  nock(BASE_URL).get("/Titulos/GGAL").reply(401, { error: "unauthorized" });
  const retryScope = nock(BASE_URL).get("/Titulos/GGAL").reply(200, { simbolo: "GGAL" });

  const client = new IolHttpClient({ authService, baseUrl: BASE_URL, timeoutMs: 5000, retries: 3, logger: makeLogger() });
  const data = await client.get("/Titulos/GGAL");

  assert.deepEqual(data, { simbolo: "GGAL" });
  assert.equal(authService.calls.invalidateAccessToken, 1);
  assert.equal(authService.calls.refreshAccessToken, 1);
  assert.ok(retryScope.isDone());
});

test("falls back to a full authenticate() when refreshAccessToken fails after a 401", async () => {
  const authService = makeFakeAuthService({
    refreshAccessToken: async () => {
      throw new Error("refresh failed");
    }
  });
  nock(BASE_URL).get("/Titulos/GGAL").reply(401, { error: "unauthorized" });
  const retryScope = nock(BASE_URL).get("/Titulos/GGAL").reply(200, { simbolo: "GGAL" });

  const client = new IolHttpClient({ authService, baseUrl: BASE_URL, timeoutMs: 5000, retries: 3, logger: makeLogger() });
  const data = await client.get("/Titulos/GGAL");

  assert.deepEqual(data, { simbolo: "GGAL" });
  assert.equal(authService.calls.authenticate, 1);
  assert.ok(retryScope.isDone());
});

test("does not retry a 401 twice in the same request", async () => {
  const authService = makeFakeAuthService();
  nock(BASE_URL).get("/Titulos/GGAL").times(2).reply(401, { error: "unauthorized" });

  const client = new IolHttpClient({ authService, baseUrl: BASE_URL, timeoutMs: 5000, retries: 3, logger: makeLogger() });

  await assert.rejects(() => client.get("/Titulos/GGAL"), /Status=401/);
});

test("retries a retriable status (503) up to the configured retry count, then throws", async () => {
  const authService = makeFakeAuthService();
  const scope = nock(BASE_URL).get("/Titulos/GGAL").times(3).reply(503, { error: "unavailable" });

  const client = new IolHttpClient({ authService, baseUrl: BASE_URL, timeoutMs: 5000, retries: 2, logger: makeLogger() });

  await assert.rejects(() => client.get("/Titulos/GGAL"), /Status=503/);
  assert.ok(scope.isDone());
});

test("succeeds after a retriable failure within the retry budget", async () => {
  const authService = makeFakeAuthService();
  nock(BASE_URL).get("/Titulos/GGAL").reply(500, { error: "server error" });
  const scope = nock(BASE_URL).get("/Titulos/GGAL").reply(200, { simbolo: "GGAL" });

  const client = new IolHttpClient({ authService, baseUrl: BASE_URL, timeoutMs: 5000, retries: 2, logger: makeLogger() });
  const data = await client.get("/Titulos/GGAL");

  assert.deepEqual(data, { simbolo: "GGAL" });
  assert.ok(scope.isDone());
});

test("does not retry a non-retriable status (404) and throws immediately", async () => {
  const authService = makeFakeAuthService();
  const scope = nock(BASE_URL).get("/Titulos/GGAL").once().reply(404, { error: "not found" });

  const client = new IolHttpClient({ authService, baseUrl: BASE_URL, timeoutMs: 5000, retries: 3, logger: makeLogger() });

  await assert.rejects(() => client.get("/Titulos/GGAL"), /Status=404/);
  assert.ok(scope.isDone());
});
