const INSTRUMENT_DEFINITIONS = [
  {
    key: "acciones",
    displayName: "Acciones",
    apiInstrument: "Acciones",
    supportsMep: false
  },
  {
    key: "cedears",
    displayName: "CEDEARs",
    apiInstrument: "Cedears",
    supportsMep: false
  },
  {
    key: "letras",
    displayName: "Letras",
    apiInstrument: "Letras",
    supportsMep: false
  },
  {
    key: "bonos",
    displayName: "Bonos",
    apiInstrument: "TitulosPublicos",
    supportsMep: true
  },
  {
    key: "ons",
    displayName: "Obligaciones Negociables",
    apiInstrument: "ObligacionesNegociables",
    supportsMep: false
  },
  {
    key: "fci",
    displayName: "FCI",
    apiInstrument: "FCI",
    supportsMep: false
  },
  {
    key: "etfs",
    displayName: "ETF",
    apiInstrument: "ETF",
    supportsMep: false
  },
  {
    key: "opciones",
    displayName: "Opciones",
    apiInstrument: "Opciones",
    supportsMep: false
  }
];

const NORMALIZED_FIELDS = [
  "instrumento",
  "simbolo",
  "descripcion",
  "mercado",
  "panel",
  "ultimoPrecio",
  "apertura",
  "cierreAnterior",
  "variacionDiaria",
  "volumen",
  "maximo",
  "minimo",
  "rango52SemanasMin",
  "rango52SemanasMax",
  "fechaHoraCotizacion",
  "mepCclImplicito",
  "fuente"
];

const DEFAULTS = {
  apiBaseUrl: "https://api.invertironline.com/api/v2",
  authUrl: "https://api.invertironline.com/token",
  pais: "argentina",
  panel: "general",
  formatos: ["csv", "xlsx"],
  outputDir: "output",
  pageSize: 100,
  maxPages: 200,
  timeoutMs: 20000,
  retries: 3,
  concurrency: 5
};

module.exports = {
  INSTRUMENT_DEFINITIONS,
  NORMALIZED_FIELDS,
  DEFAULTS
};
