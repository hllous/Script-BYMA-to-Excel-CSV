const { NORMALIZED_FIELDS } = require("../config/constants");
const { formatDateInArgentina } = require("../utils/dateFormat");

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toDateTimeOrNull(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  // Exported as a human-readable Argentina-local timestamp (matching every
  // other date shown by this app) instead of a raw ISO string like
  // "2026-07-30T19:59:47.794Z", which is illegible in the CSV/XLSX output.
  return Number.isNaN(date.getTime()) ? null : formatDateInArgentina(date);
}

function createBaseQuote() {
  return {
    instrumento: null,
    simbolo: null,
    descripcion: null,
    mercado: null,
    panel: null,
    ultimoPrecio: null,
    apertura: null,
    cierreAnterior: null,
    variacionDiaria: null,
    volumen: null,
    maximo: null,
    minimo: null,
    rango52SemanasMin: null,
    rango52SemanasMax: null,
    fechaHoraCotizacion: null,
    mepCclImplicito: null,
    fuente: null
  };
}

function buildNormalizedQuote(partialQuote) {
  const baseQuote = createBaseQuote();
  const merged = { ...baseQuote, ...partialQuote };

  return {
    ...merged,
    ultimoPrecio: toNumberOrNull(merged.ultimoPrecio),
    apertura: toNumberOrNull(merged.apertura),
    cierreAnterior: toNumberOrNull(merged.cierreAnterior),
    variacionDiaria: toNumberOrNull(merged.variacionDiaria),
    volumen: toNumberOrNull(merged.volumen),
    maximo: toNumberOrNull(merged.maximo),
    minimo: toNumberOrNull(merged.minimo),
    rango52SemanasMin: toNumberOrNull(merged.rango52SemanasMin),
    rango52SemanasMax: toNumberOrNull(merged.rango52SemanasMax),
    mepCclImplicito: toNumberOrNull(merged.mepCclImplicito),
    fechaHoraCotizacion: toDateTimeOrNull(merged.fechaHoraCotizacion)
  };
}

function pickNormalizedColumns(record) {
  const normalized = {};
  for (const key of NORMALIZED_FIELDS) {
    normalized[key] = key in record ? record[key] : null;
  }
  return normalized;
}

module.exports = {
  buildNormalizedQuote,
  pickNormalizedColumns,
  createBaseQuote
};
