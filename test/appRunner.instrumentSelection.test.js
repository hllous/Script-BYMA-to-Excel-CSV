const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  shouldUseInteractiveMenu,
  formatTokenToFormatos,
  buildInstrumentTargetsFromSelection
} = require("../src/appRunner");

test("shouldUseInteractiveMenu is true when interactive and no CLI instrumentos/formato flags were given", () => {
  assert.equal(shouldUseInteractiveMenu({ interactive: true }, { instrumentos: null, formatos: null }), true);
});

test("shouldUseInteractiveMenu is false when interactive is off", () => {
  assert.equal(shouldUseInteractiveMenu({ interactive: false }, { instrumentos: null, formatos: null }), false);
});

test("shouldUseInteractiveMenu is false when --instrumentos was supplied via CLI", () => {
  assert.equal(shouldUseInteractiveMenu({ interactive: true }, { instrumentos: ["acciones"], formatos: null }), false);
});

test("shouldUseInteractiveMenu is false when --formato was supplied via CLI", () => {
  assert.equal(shouldUseInteractiveMenu({ interactive: true }, { instrumentos: null, formatos: ["csv"] }), false);
});

test("formatTokenToFormatos maps csv to just csv", () => {
  assert.deepEqual(formatTokenToFormatos("csv"), ["csv"]);
});

test("formatTokenToFormatos maps xlsx to just xlsx", () => {
  assert.deepEqual(formatTokenToFormatos("xlsx"), ["xlsx"]);
});

test("formatTokenToFormatos maps both (and anything else) to csv+xlsx", () => {
  assert.deepEqual(formatTokenToFormatos("both"), ["csv", "xlsx"]);
});

const CACHE = {
  categories: {
    acciones: [
      { simbolo: "GGAL", descripcion: "Grupo Financiero Galicia" },
      { simbolo: "YPFD", descripcion: "YPF" }
    ],
    cedears: [{ simbolo: "AAPL", descripcion: "Apple" }]
  }
};

test("buildInstrumentTargetsFromSelection expands a fully-selected category into every cached symbol", () => {
  const targets = buildInstrumentTargetsFromSelection({ categories: ["acciones"], symbols: [] }, CACHE);

  assert.equal(targets.length, 1);
  assert.equal(targets[0].definition.key, "acciones");
  assert.deepEqual(
    targets[0].symbolRecords.map((r) => r.simbolo),
    ["GGAL", "YPFD"]
  );
  assert.equal(targets[0].symbolRecords[0].descripcion, "Grupo Financiero Galicia");
});

test("buildInstrumentTargetsFromSelection includes only the picked ticker for a partial category", () => {
  const targets = buildInstrumentTargetsFromSelection(
    { categories: [], symbols: [{ category: "acciones", simbolo: "GGAL" }] },
    CACHE
  );

  assert.equal(targets.length, 1);
  assert.deepEqual(targets[0].symbolRecords, [
    { simbolo: "GGAL", descripcion: "Grupo Financiero Galicia", mercado: null, panel: null }
  ]);
});

test("buildInstrumentTargetsFromSelection mixes full categories and ad-hoc tickers across categories", () => {
  const targets = buildInstrumentTargetsFromSelection(
    { categories: ["acciones"], symbols: [{ category: "cedears", simbolo: "AAPL" }] },
    CACHE
  );

  assert.equal(targets.length, 2);
  const byKey = Object.fromEntries(targets.map((t) => [t.definition.key, t.symbolRecords]));
  assert.deepEqual(
    byKey.acciones.map((r) => r.simbolo),
    ["GGAL", "YPFD"]
  );
  assert.deepEqual(byKey.cedears, [{ simbolo: "AAPL", descripcion: "Apple", mercado: null, panel: null }]);
});

test("buildInstrumentTargetsFromSelection returns an empty list for an empty selection", () => {
  assert.deepEqual(buildInstrumentTargetsFromSelection({ categories: [], symbols: [] }, CACHE), []);
});

test("buildInstrumentTargetsFromSelection ignores stale categories and symbols missing from the current cache", () => {
  const targets = buildInstrumentTargetsFromSelection(
    {
      categories: ["fci"],
      symbols: [
        { category: "acciones", simbolo: "GGAL" },
        { category: "acciones", simbolo: "STALE" }
      ]
    },
    CACHE
  );

  assert.equal(targets.length, 1);
  assert.deepEqual(targets[0].symbolRecords.map((record) => record.simbolo), ["GGAL"]);
});
