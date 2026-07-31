const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildNormalizedQuote, pickNormalizedColumns } = require("../../src/models/quoteSchema");
const { NORMALIZED_FIELDS } = require("../../src/config/constants");

test("buildNormalizedQuote fills unset fields with null defaults", () => {
  const quote = buildNormalizedQuote({ instrumento: "acciones", simbolo: "GGAL" });

  assert.equal(quote.instrumento, "acciones");
  assert.equal(quote.simbolo, "GGAL");
  assert.equal(quote.descripcion, null);
  assert.equal(quote.ultimoPrecio, null);
  assert.equal(quote.fechaHoraCotizacion, null);
});

test("buildNormalizedQuote coerces numeric-looking strings to numbers", () => {
  const quote = buildNormalizedQuote({ ultimoPrecio: "123.45", volumen: "1000" });

  assert.equal(quote.ultimoPrecio, 123.45);
  assert.equal(quote.volumen, 1000);
});

test("buildNormalizedQuote coerces non-numeric values to null instead of NaN", () => {
  const quote = buildNormalizedQuote({ ultimoPrecio: "n/d", maximo: undefined });

  assert.equal(quote.ultimoPrecio, null);
  assert.equal(quote.maximo, null);
});

test("buildNormalizedQuote normalizes a valid date to a readable Argentina-local timestamp, not raw ISO", () => {
  const quote = buildNormalizedQuote({ fechaHoraCotizacion: "2026-07-30T12:00:00.000Z" });

  assert.notEqual(quote.fechaHoraCotizacion, "2026-07-30T12:00:00.000Z");
  assert.match(quote.fechaHoraCotizacion, /^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/);
});

test("buildNormalizedQuote normalizes an invalid date to null", () => {
  const quote = buildNormalizedQuote({ fechaHoraCotizacion: "no-es-una-fecha" });

  assert.equal(quote.fechaHoraCotizacion, null);
});

test("pickNormalizedColumns keeps only NORMALIZED_FIELDS keys, in that set", () => {
  const record = { instrumento: "cedears", simbolo: "AAPL", campoNoEsperado: "x" };

  const picked = pickNormalizedColumns(record);

  assert.deepEqual(Object.keys(picked).sort(), [...NORMALIZED_FIELDS].sort());
  assert.equal(picked.campoNoEsperado, undefined);
});

test("pickNormalizedColumns fills missing fields with null", () => {
  const picked = pickNormalizedColumns({ instrumento: "bonos" });

  assert.equal(picked.simbolo, null);
  assert.equal(picked.ultimoPrecio, null);
});
