const { test } = require("node:test");
const assert = require("node:assert/strict");
const { promptForCredentials } = require("../../src/utils/prompt");

test("promptForCredentials returns trimmed username/password when both are pre-supplied (no prompt shown)", async () => {
  const result = await promptForCredentials("  nico  ", "  hunter2  ");
  assert.deepEqual(result, { username: "nico", password: "hunter2" });
});
