const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const nock = require("nock");
const { AuthService } = require("../../src/services/authService");

const AUTH_URL = "https://fake-iol.test/token";

beforeEach(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
  nock.enableNetConnect();
});

function makeLogger() {
  const messages = { info: [], warn: [], error: [] };
  return {
    messages,
    info: (msg) => messages.info.push(msg),
    warn: (msg) => messages.warn.push(msg),
    error: (msg) => messages.error.push(msg)
  };
}

function makeAuthService(overrides = {}) {
  return new AuthService({
    username: "nico",
    password: "hunter2",
    authUrl: AUTH_URL,
    timeoutMs: 5000,
    logger: makeLogger(),
    ...overrides
  });
}

test("getAccessToken performs a password-grant login and returns the access token", async () => {
  const scope = nock("https://fake-iol.test")
    .post("/token", /grant_type=password/)
    .reply(200, { access_token: "token-1", refresh_token: "refresh-1", expires_in: 900 });

  const service = makeAuthService();
  const token = await service.getAccessToken();

  assert.equal(token, "token-1");
  assert.ok(scope.isDone());
});

test("getAccessToken reuses the cached token on a second call within its lifetime", async () => {
  const scope = nock("https://fake-iol.test")
    .post("/token")
    .once()
    .reply(200, { access_token: "token-1", refresh_token: "refresh-1", expires_in: 900 });

  const service = makeAuthService();
  const first = await service.getAccessToken();
  const second = await service.getAccessToken();

  assert.equal(first, "token-1");
  assert.equal(second, "token-1");
  assert.ok(scope.isDone());
});

test("getAccessToken uses the refresh grant once a token is expired, keeping the same refresh token", async () => {
  nock("https://fake-iol.test")
    .post("/token", /grant_type=password/)
    .reply(200, { access_token: "token-1", refresh_token: "refresh-1", expires_in: -1 });

  const refreshScope = nock("https://fake-iol.test")
    .post("/token", (body) => body.grant_type === "refresh_token" && body.refresh_token === "refresh-1")
    .reply(200, { access_token: "token-2", expires_in: 900 });

  const service = makeAuthService();
  await service.getAccessToken();
  const refreshed = await service.getAccessToken();

  assert.equal(refreshed, "token-2");
  assert.ok(refreshScope.isDone());
});

test("getAccessToken falls back to a full login when the refresh grant fails", async () => {
  nock("https://fake-iol.test")
    .post("/token", /grant_type=password/)
    .reply(200, { access_token: "token-1", refresh_token: "refresh-1", expires_in: -1 });

  nock("https://fake-iol.test")
    .post("/token", (body) => body.grant_type === "refresh_token")
    .reply(400, { error: "invalid_grant" });

  const loginScope = nock("https://fake-iol.test")
    .post("/token", /grant_type=password/)
    .reply(200, { access_token: "token-3", refresh_token: "refresh-3", expires_in: 900 });

  const service = makeAuthService();
  await service.getAccessToken();
  const token = await service.getAccessToken();

  assert.equal(token, "token-3");
  assert.ok(loginScope.isDone());
});

test("authenticate throws when username or password is missing", async () => {
  const service = makeAuthService({ username: null });

  await assert.rejects(() => service.authenticate(), /Faltan credenciales de IOL/);
});

test("storeTokens throws a descriptive error when the response has no access_token", async () => {
  nock("https://fake-iol.test").post("/token").reply(200, { foo: "bar" });

  const service = makeAuthService();

  await assert.rejects(() => service.authenticate(), /sin access_token/);
});

test("invalidateAccessToken forces the next getAccessToken call to re-authenticate", async () => {
  nock("https://fake-iol.test")
    .post("/token", /grant_type=password/)
    .reply(200, { access_token: "token-1", refresh_token: "refresh-1", expires_in: 900 });

  const relogInScope = nock("https://fake-iol.test")
    .post("/token", (body) => body.grant_type === "refresh_token")
    .reply(200, { access_token: "token-4", expires_in: 900 });

  const service = makeAuthService();
  await service.getAccessToken();
  service.invalidateAccessToken();
  const token = await service.getAccessToken();

  assert.equal(token, "token-4");
  assert.ok(relogInScope.isDone());
});
