const path = require("node:path");
const { Select, MultiSelect, AutoComplete, Confirm, Input } = require("enquirer");
const { INSTRUMENT_DEFINITIONS } = require("./config/constants");

const UPDATE_SYMBOL_LIST_CHOICE = "__update_symbol_list__";
const BACK_CHOICE = "__back__";
const TODOS_CHOICE = "__todos__";
const CUSTOM_CHOICE = "__custom__";
const START_CHOICE = "start";
const CHANGE_OUTPUT_CHOICE = "change-output";
const LOGOUT_CHOICE = "logout";
const UNINSTALL_CHOICE = "uninstall";
const EXIT_CHOICE = "exit";
const MAIN_MENU_CHOICE = "__main_menu__";

async function promptForStartupAction({ selectPrompt = (options) => new Select(options) } = {}) {
  const prompt = selectPrompt({
    name: "startupAction",
    message: "¿Qué desea hacer?",
    choices: [
      { name: START_CHOICE, message: "Iniciar ScriptIOLExcel" },
      { name: CHANGE_OUTPUT_CHOICE, message: "Cambiar carpeta de salida" },
      { name: LOGOUT_CHOICE, message: "Cerrar sesión de IOL" },
      { name: UNINSTALL_CHOICE, message: "Eliminar datos de la aplicación" },
      { name: EXIT_CHOICE, message: "Salir" }
    ],
    footer: "\n( ↑↓ mover · ↵ confirmar )"
  });
  return prompt.run();
}

async function promptForOutputDirectory(currentOutputDir, { inputPrompt = (options) => new Input(options) } = {}) {
  const prompt = inputPrompt({
    name: "salida",
    message: "Carpeta donde se guardarán los archivos:",
    initial: currentOutputDir,
    footer: "\n( ↵ mantener esta carpeta · escribir una ruta para cambiarla )",
    validate(value) {
      return String(value || "").trim() ? true : "Ingresá una carpeta de salida.";
    }
  });
  const selectedDirectory = await prompt.run();
  return path.resolve(String(selectedDirectory).trim());
}

async function promptForOutputFormat({
  allowBack = false,
  multiSelectPrompt = (options) => new MultiSelect(options)
} = {}) {
  const choices = [
    { name: "both", message: "CSV + XLSX" },
    { name: "csv", message: "Solo CSV" },
    { name: "xlsx", message: "Solo XLSX" }
  ];
  if (allowBack) {
    choices.push({ name: BACK_CHOICE, message: "Volver a seleccionar instrumentos" });
  }

  const prompt = multiSelectPrompt({
    name: "formato",
    message: "Formato de salida:",
    choices,
    maxSelected: 1,
    footer: "\n( ↑↓ mover · ␣ seleccionar · ↵ continuar )",
    validate(value) {
      return value.length === 1 ? true : "Seleccioná un único formato antes de continuar.";
    },
    format() {
      if (!this.state.submitted) return "";
      return this.selected.map((choice) => this.styles.primary(choice.message)).join(", ");
    }
  });

  const selected = await prompt.run();
  return selected[0];
}

function symbolChoiceName(categoryKey, simbolo) {
  return `${categoryKey}::${simbolo}`;
}

function availableCategoryDefinitions(cache) {
  return INSTRUMENT_DEFINITIONS.filter(
    (definition) => Array.isArray(cache.categories[definition.key]) && cache.categories[definition.key].length > 0
  );
}

function buildSymbolPickerChoices(cache, { allowBack = false } = {}) {
  const categoryChoices = availableCategoryDefinitions(cache).map((def) => ({
    name: def.key,
    message: def.displayName,
    choices: cache.categories[def.key].map((symbol) => ({
      name: symbolChoiceName(def.key, symbol.simbolo),
      message: `${symbol.simbolo} - ${symbol.descripcion}`
    }))
  }));

  const rows = [...categoryChoices];
  if (allowBack) {
    rows.push({ name: BACK_CHOICE, message: "Volver al menú" });
  }
  rows.push({ name: UPDATE_SYMBOL_LIST_CHOICE, message: "Actualizar lista de símbolos desde IOL" });

  return rows;
}

function selectionToInitialNames(selection, cache) {
  if (!selection) return undefined;

  const hasCache = Boolean(cache && cache.categories);
  const availableCategories = hasCache ? new Set(availableCategoryDefinitions(cache).map((definition) => definition.key)) : null;
  const names = (selection.categories || []).filter((category) => !hasCache || availableCategories.has(category));
  for (const { category, simbolo } of selection.symbols || []) {
    const isAvailable =
      !hasCache ||
      (Array.isArray(cache.categories[category]) &&
        cache.categories[category].some((symbol) => symbol.simbolo === simbolo));
    if (isAvailable) {
      names.push(symbolChoiceName(category, simbolo));
    }
  }
  return names.length ? names : undefined;
}

function buildSymbolSelectionShape(choices) {
  const categories = [];
  const symbols = [];
  let updateRequested = false;
  let backRequested = false;

  for (const choice of choices) {
    if (choice.name === UPDATE_SYMBOL_LIST_CHOICE) {
      if (choice.enabled) updateRequested = true;
      continue;
    }

    if (choice.name === BACK_CHOICE) {
      if (choice.enabled) backRequested = true;
      continue;
    }

    if (!Array.isArray(choice.choices)) continue;

    // Deliberately not trusting enquirer's own `choice.enabled` rollup on the category
    // header here: enquirer's ArrayPrompt.toggle() recomputes it with a polarity bug
    // (vacuously true whenever no child is literally flagged disabled/hidden), and its
    // one corrective pass (the free `reset()` function) only fixes headers still present
    // in the current *rendered* choices - which excludes the header entirely once a
    // search filter narrows the view to matching leaf children. Recomputing from the
    // children's own (always-correct) `enabled` flags sidesteps that upstream bug.
    const allChildrenEnabled = choice.choices.length > 0 && choice.choices.every((child) => child.enabled === true);

    if (allChildrenEnabled) {
      categories.push(choice.name);
      continue;
    }

    for (const child of choice.choices) {
      if (child.enabled) {
        const [category, simbolo] = child.name.split("::");
        symbols.push({ category, simbolo });
      }
    }
  }

  return { categories, symbols, updateRequested, backRequested };
}

async function promptForSymbolSelection({
  cache,
  initialSelection,
  onUpdateSymbolList,
  promptOverrides,
  allowBack = false
} = {}) {
  if (!cache || !cache.categories) {
    throw new Error("No hay caché de símbolos. Actualice la lista desde IOL antes de continuar.");
  }

  const choices = buildSymbolPickerChoices(cache, { allowBack });
  const initial = selectionToInitialNames(initialSelection, cache);

  const prompt = new AutoComplete({
    name: "symbols",
    message: "Seleccionar instrumentos:",
    multiple: true,
    limit: 15,
    initial,
    choices,
    // enquirer's Select/AutoComplete render a muted "…" in place of the normal
    // pointer while the prompt is still active (see select.js's separator()) -
    // any truthy string here bypasses that placeholder for the normal pointer symbol.
    // Must be plain ASCII: enquirer's own cursor-position math (ansi.js strLen())
    // counts any character above code point 128 as double-width (a CJK-width
    // heuristic), which doesn't match how a non-wide symbol like "›" actually
    // renders in a real terminal - that 1-column overcount left a visible gap
    // between the last typed character and the blinking cursor.
    separator: ">",
    footer: "\n( ⌨ buscar · ␣ marcar · ↵ confirmar )",
    // Block submitting with nothing picked - "Volver al menu" and "Actualizar
    // lista" are always valid exits even with zero tickers marked, but an
    // empty selection otherwise used to sail through, only to blow up much
    // later with a generic "no valid options" crash once the run actually
    // started.
    validate() {
      const topLevel = this.state._choices.filter((choice) => !choice.parent);
      const shape = buildSymbolSelectionShape(topLevel);
      if (shape.backRequested || shape.updateRequested) return true;
      if (shape.categories.length === 0 && shape.symbols.length === 0) {
        return "Selecciona al menos un símbolo antes de confirmar.";
      }
      return true;
    },
    ...promptOverrides
  });

  await prompt.run();

  // Read from state._choices (the full, unfiltered set enquirer accumulates),
  // not prompt.choices: while a search filter is active, prompt.choices is
  // narrowed to the visible subset, which would silently drop selections
  // outside the current filter if the user submits without clearing it.
  const topLevelChoices = prompt.state._choices.filter((choice) => !choice.parent);
  const shape = buildSymbolSelectionShape(topLevelChoices);

  if (shape.backRequested) {
    return { back: true };
  }

  if (shape.updateRequested) {
    if (typeof onUpdateSymbolList !== "function") {
      throw new Error("No se puede actualizar la lista de símbolos: falta onUpdateSymbolList");
    }

    const freshCache = await onUpdateSymbolList();
    return promptForSymbolSelection({
      cache: freshCache,
      initialSelection: { categories: shape.categories, symbols: shape.symbols },
      onUpdateSymbolList,
      promptOverrides,
      allowBack
    });
  }

  return { categories: shape.categories, symbols: shape.symbols };
}

function buildPresetMenuChoices(cache) {
  const categoryChoices = availableCategoryDefinitions(cache).map((def) => ({ name: def.key, message: def.displayName }));

  return [
    { name: TODOS_CHOICE, message: "Todos" },
    ...categoryChoices,
    { name: CUSTOM_CHOICE, message: "Custom (elegir símbolos específicos)" },
    { name: MAIN_MENU_CHOICE, message: "Volver al menú principal" },
    { name: EXIT_CHOICE, message: "Salir" }
  ];
}

function resolvePresetMenuSelection(picked, categoryKeys) {
  if (picked.includes(EXIT_CHOICE)) {
    return { mode: "exit" };
  }

  if (picked.includes(MAIN_MENU_CHOICE)) {
    return { mode: "main" };
  }

  if (picked.includes(CUSTOM_CHOICE)) {
    return { mode: "custom" };
  }

  if (picked.includes(TODOS_CHOICE)) {
    return { mode: "categories", categories: categoryKeys };
  }

  return { mode: "categories", categories: picked };
}

async function promptForInstrumentPresetMenu({ cache, menuOverrides } = {}) {
  const choices = buildPresetMenuChoices(cache);
  const categoryKeys = choices
    .map((choice) => choice.name)
    .filter((name) => ![TODOS_CHOICE, CUSTOM_CHOICE, MAIN_MENU_CHOICE, EXIT_CHOICE].includes(name));

  const prompt = new MultiSelect({
    name: "preset",
    message: "Seleccionar qué instrumentos exportar:",
    choices,
    footer: "\n( ␣ marcar · ↵ confirmar )",
    // Nothing starts pre-checked - the user must actively pick something.
    // Submitting empty is blocked here instead of letting it through to crash
    // later deep inside the run.
    validate(value) {
      return value.length > 0 ? true : "Selecciona al menos una opción antes de confirmar.";
    },
    // enquirer's Select/MultiSelect default format() echoes the raw internal
    // choice.name (e.g. "__custom__") once submitted, not the human-readable
    // choice.message - override it to show the label the user actually picked.
    format() {
      if (!this.state.submitted) return "";
      return this.selected.map((choice) => this.styles.primary(choice.message)).join(", ");
    },
    ...menuOverrides
  });

  const picked = await prompt.run();
  return resolvePresetMenuSelection(picked, categoryKeys);
}

// Top-level entry point for choosing what to export: shows the preset menu (whole
// categories, "Todos", or "Custom") first, only dropping into the searchable per-symbol
// picker (promptForSymbolSelection) when the user picks "Custom" from that menu. Picking
// "Volver al menu" from the custom picker returns here, re-showing the preset menu.
async function promptForInstrumentSelection({
  cache,
  onUpdateSymbolList,
  promptOverrides,
  menuOverrides,
  presetMenu = promptForInstrumentPresetMenu,
  customPicker = promptForSymbolSelection
} = {}) {
  if (!cache || !cache.categories) {
    throw new Error("No hay caché de símbolos. Actualice la lista desde IOL antes de continuar.");
  }

  let currentCache = cache;
  const updateSymbolList =
    typeof onUpdateSymbolList === "function"
      ? async () => {
          const freshCache = await onUpdateSymbolList();
          currentCache = freshCache;
          return freshCache;
        }
      : undefined;

  for (;;) {
    const menuResult = await presetMenu({ cache: currentCache, menuOverrides });

    if (menuResult.mode === "main") {
      return { mainMenu: true };
    }

    if (menuResult.mode === "exit") {
      return { exit: true };
    }

    if (menuResult.mode !== "custom") {
      return { categories: menuResult.categories, symbols: [] };
    }

    const result = await customPicker({
      cache: currentCache,
      onUpdateSymbolList: updateSymbolList,
      promptOverrides,
      allowBack: true
    });
    if (result.back) {
      continue;
    }
    return result;
  }
}

function hasSelection(selection) {
  return Boolean(selection && ((selection.categories || []).length || (selection.symbols || []).length));
}

function categoryDisplayName(key) {
  const definition = INSTRUMENT_DEFINITIONS.find((def) => def.key === key);
  return definition ? definition.displayName : key;
}

function formatSelectionSummary(selection) {
  const categoryNames = (selection.categories || []).map(categoryDisplayName);
  const tickers = (selection.symbols || []).map((entry) => entry.simbolo);

  return [...categoryNames, ...tickers].join(", ");
}

async function promptForPostRunAction() {
  const prompt = new Select({
    name: "postRun",
    message: "¿Qué quiere hacer ahora?",
    choices: [
      { name: "menu", message: "Volver a seleccionar instrumentos" },
      { name: "main-menu", message: "Volver al menú principal" },
      { name: LOGOUT_CHOICE, message: "Cerrar sesión de IOL" },
      { name: "quit", message: "Salir" }
    ],
    footer: "\n( ↑↓ mover · ↵ confirmar )"
  });

  return prompt.run();
}

async function promptToReuseLastSelection(summary) {
  return new Confirm({
    name: "reuseLastSelection",
    message: `¿Usar la última selección (${summary})?`,
    initial: true
  }).run();
}

async function promptForSymbolSelectionWithReuse({
  cache,
  lastSelectionService,
  onUpdateSymbolList,
  promptOverrides,
  menuOverrides,
  selectSymbols = promptForInstrumentSelection,
  confirmReuse = promptToReuseLastSelection
} = {}) {
  const lastSelection = lastSelectionService.readSelection();

  if (hasSelection(lastSelection)) {
    const reuse = await confirmReuse(formatSelectionSummary(lastSelection));
    if (reuse) {
      return lastSelection;
    }
  }

  // Declining reuse discards the old selection entirely - the picker/menu always
  // starts blank here, it's never pre-checked with what was just declined.
  const selection = await selectSymbols({ cache, onUpdateSymbolList, promptOverrides, menuOverrides });
  if (!selection.mainMenu && !selection.exit) {
    lastSelectionService.writeSelection(selection);
  }
  return selection;
}

module.exports = {
  promptForStartupAction,
  promptForOutputDirectory,
  promptForOutputFormat,
  promptForSymbolSelection,
  promptForSymbolSelectionWithReuse,
  promptForInstrumentSelection,
  promptForInstrumentPresetMenu,
  promptForPostRunAction,
  promptToReuseLastSelection,
  formatSelectionSummary,
  buildSymbolPickerChoices,
  buildSymbolSelectionShape,
  buildPresetMenuChoices,
  resolvePresetMenuSelection,
  selectionToInitialNames,
  symbolChoiceName,
  UPDATE_SYMBOL_LIST_CHOICE,
  BACK_CHOICE,
  TODOS_CHOICE,
  CUSTOM_CHOICE,
  START_CHOICE,
  CHANGE_OUTPUT_CHOICE,
  LOGOUT_CHOICE,
  UNINSTALL_CHOICE,
  EXIT_CHOICE,
  MAIN_MENU_CHOICE
};
