const { test } = require("node:test");
const assert = require("node:assert/strict");
const { applyCalculatedImplicitCcl } = require("../src/appRunner");

function row(overrides) {
  return {
    instrumento: "bonos",
    simbolo: "AL30",
    ultimoPrecio: null,
    mepCclImplicito: null,
    ...overrides
  };
}

test("computes implied CCL as ars_price / usd_price for a matching ARS/USD symbol pair", () => {
  const rows = [row({ simbolo: "AL30", ultimoPrecio: 1000 }), row({ simbolo: "AL30D", ultimoPrecio: 2 })];

  applyCalculatedImplicitCcl(rows);

  assert.equal(rows[0].mepCclImplicito, 500);
  assert.equal(rows[1].mepCclImplicito, 500);
});

test("leaves mepCclImplicito null when only the ARS side of the pair is present", () => {
  const rows = [row({ simbolo: "AL30", ultimoPrecio: 1000 })];

  applyCalculatedImplicitCcl(rows);

  assert.equal(rows[0].mepCclImplicito, null);
});

test("does not pair symbols across different instrumento values", () => {
  const rows = [
    row({ instrumento: "bonos", simbolo: "AL30", ultimoPrecio: 1000 }),
    row({ instrumento: "acciones", simbolo: "AL30D", ultimoPrecio: 2 })
  ];

  applyCalculatedImplicitCcl(rows);

  assert.equal(rows[0].mepCclImplicito, null);
  assert.equal(rows[1].mepCclImplicito, null);
});

test("ignores a non-positive USD-side price", () => {
  const rows = [row({ simbolo: "AL30", ultimoPrecio: 1000 }), row({ simbolo: "AL30D", ultimoPrecio: 0 })];

  applyCalculatedImplicitCcl(rows);

  assert.equal(rows[0].mepCclImplicito, null);
  assert.equal(rows[1].mepCclImplicito, null);
});

test("skips rows with no price at all", () => {
  const rows = [row({ simbolo: "AL30", ultimoPrecio: null })];

  assert.doesNotThrow(() => applyCalculatedImplicitCcl(rows));
  assert.equal(rows[0].mepCclImplicito, null);
});
