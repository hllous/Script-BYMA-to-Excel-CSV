const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  promptForOutputDirectory,
  promptForOutputFormat,
  promptForStartupAction,
  buildSymbolPickerChoices,
  buildSymbolSelectionShape,
  selectionToInitialNames,
  symbolChoiceName,
  formatSelectionSummary,
  promptForSymbolSelectionWithReuse,
  promptForInstrumentSelection,
  buildPresetMenuChoices,
  resolvePresetMenuSelection,
  UPDATE_SYMBOL_LIST_CHOICE,
  BACK_CHOICE,
  TODOS_CHOICE,
  CUSTOM_CHOICE,
  CHANGE_OUTPUT_CHOICE,
  LOGOUT_CHOICE,
  EXIT_CHOICE,
  MAIN_MENU_CHOICE
} = require("../src/interactiveMenu");

test("promptForStartupAction exposes all executable menu actions", async () => {
  let receivedOptions;
  const result = await promptForStartupAction({
    selectPrompt: (options) => {
      receivedOptions = options;
      return { run: async () => "uninstall" };
    }
  });

  assert.equal(result, "uninstall");
  assert.deepEqual(receivedOptions.choices.map((choice) => choice.name), [
    "start",
    CHANGE_OUTPUT_CHOICE,
    LOGOUT_CHOICE,
    "uninstall",
    EXIT_CHOICE
  ]);
});

test("promptForOutputDirectory shows the current folder and resolves a custom selection", async () => {
  let receivedOptions;
  const chosen = await promptForOutputDirectory("output", {
    inputPrompt: (options) => {
      receivedOptions = options;
      return { run: async () => "exports/custom" };
    }
  });

  assert.equal(receivedOptions.initial, "output");
  assert.equal(chosen, path.resolve("exports/custom"));
});

test("promptForOutputFormat requires one space-selected format before Enter continues", async () => {
  let receivedOptions;
  const result = await promptForOutputFormat({
    multiSelectPrompt: (options) => {
      receivedOptions = options;
      return { run: async () => ["xlsx"] };
    }
  });

  assert.equal(result, "xlsx");
  assert.equal(receivedOptions.maxSelected, 1);
  assert.match(receivedOptions.footer, /␣ seleccionar/);
  assert.equal(receivedOptions.validate([]), "Seleccioná un único formato antes de continuar.");
  assert.equal(receivedOptions.validate(["csv"]), true);
});

const CACHE = {
  categories: {
    acciones: [
      { simbolo: "GGAL", descripcion: "Grupo Financiero Galicia" },
      { simbolo: "YPFD", descripcion: "YPF" }
    ],
    cedears: [{ simbolo: "AAPL", descripcion: "Apple" }],
    fci: [],
    etfs: []
  }
};

test("buildSymbolPickerChoices creates one category row per non-empty category, plus the update row", () => {
  const choices = buildSymbolPickerChoices(CACHE);

  const names = choices.map((c) => c.name);
  assert.deepEqual(names, ["acciones", "cedears", UPDATE_SYMBOL_LIST_CHOICE]);

  const acciones = choices.find((c) => c.name === "acciones");
  assert.deepEqual(
    acciones.choices.map((c) => c.name),
    ["acciones::GGAL", "acciones::YPFD"]
  );
});

test("buildSymbolPickerChoices omits categories with zero symbols", () => {
  const choices = buildSymbolPickerChoices(CACHE);
  assert.ok(!choices.some((c) => c.name === "fci" || c.name === "etfs"));
});

test("buildSymbolPickerChoices adds a 'volver al menu' row before the update row when allowBack is true", () => {
  const choices = buildSymbolPickerChoices(CACHE, { allowBack: true });
  assert.deepEqual(choices.map((c) => c.name), ["acciones", "cedears", BACK_CHOICE, UPDATE_SYMBOL_LIST_CHOICE]);
});

test("buildSymbolPickerChoices omits the 'volver al menu' row by default", () => {
  const choices = buildSymbolPickerChoices(CACHE);
  assert.ok(!choices.some((c) => c.name === BACK_CHOICE));
});

test("selectionToInitialNames expands categories and namespaced symbol names", () => {
  const names = selectionToInitialNames({
    categories: ["acciones"],
    symbols: [{ category: "cedears", simbolo: "AAPL" }]
  });
  assert.deepEqual(names, ["acciones", "cedears::AAPL"]);
});

test("selectionToInitialNames returns undefined for empty/missing selection", () => {
  assert.equal(selectionToInitialNames(undefined), undefined);
  assert.equal(selectionToInitialNames({ categories: [], symbols: [] }), undefined);
});

test("selectionToInitialNames drops selections that disappeared from a refreshed cache", () => {
  const refreshedCache = {
    categories: {
      acciones: [{ simbolo: "GGAL", descripcion: "Grupo Financiero Galicia" }],
      cedears: []
    }
  };

  assert.deepEqual(
    selectionToInitialNames(
      {
        categories: ["cedears"],
        symbols: [
          { category: "acciones", simbolo: "GGAL" },
          { category: "acciones", simbolo: "REMOVED" }
        ]
      },
      refreshedCache
    ),
    ["acciones::GGAL"]
  );
});

test("symbolChoiceName namespaces by category to avoid cross-category collisions", () => {
  assert.equal(symbolChoiceName("acciones", "GGAL"), "acciones::GGAL");
});

test("buildSymbolSelectionShape reports a fully-enabled category as a category pick, not individual symbols", () => {
  const choices = [
    {
      name: "acciones",
      enabled: true,
      choices: [
        { name: "acciones::GGAL", enabled: true },
        { name: "acciones::YPFD", enabled: true }
      ]
    },
    { name: UPDATE_SYMBOL_LIST_CHOICE, enabled: false }
  ];

  const shape = buildSymbolSelectionShape(choices);
  assert.deepEqual(shape, { categories: ["acciones"], symbols: [], updateRequested: false, backRequested: false });
});

test("buildSymbolSelectionShape reports a partially-enabled category as individual symbol picks", () => {
  const choices = [
    {
      name: "acciones",
      enabled: false,
      choices: [
        { name: "acciones::GGAL", enabled: true },
        { name: "acciones::YPFD", enabled: false }
      ]
    },
    { name: UPDATE_SYMBOL_LIST_CHOICE, enabled: false }
  ];

  const shape = buildSymbolSelectionShape(choices);
  assert.deepEqual(shape, {
    categories: [],
    symbols: [{ category: "acciones", simbolo: "GGAL" }],
    updateRequested: false,
    backRequested: false
  });
});

test("buildSymbolSelectionShape mixes fully-selected categories and ad-hoc individual picks across categories", () => {
  const choices = [
    {
      name: "acciones",
      enabled: true,
      choices: [
        { name: "acciones::GGAL", enabled: true },
        { name: "acciones::YPFD", enabled: true }
      ]
    },
    {
      name: "cedears",
      enabled: false,
      choices: [
        { name: "cedears::AAPL", enabled: true },
        { name: "cedears::MSFT", enabled: false }
      ]
    },
    { name: UPDATE_SYMBOL_LIST_CHOICE, enabled: false }
  ];

  const shape = buildSymbolSelectionShape(choices);
  assert.deepEqual(shape, {
    categories: ["acciones"],
    symbols: [{ category: "cedears", simbolo: "AAPL" }],
    updateRequested: false,
    backRequested: false
  });
});

test("buildSymbolSelectionShape ignores a category header's own enabled flag when its children disagree (enquirer toggle-rollup quirk)", () => {
  // Regression test for a real enquirer bug (traced via node_modules/enquirer/lib/types/array.js):
  // ArrayPrompt.toggle()'s parent-rollup walk computes `parent.enabled` from
  // `parent.choices.filter(isDisabled)` (vacuously true when no child is literally
  // disabled/hidden), then a separate `reset()` pass is supposed to correct it - but
  // only for headers still present in the prompt's *currently rendered* choices, which
  // excludes the header once a search filter narrows the view to matching children only.
  // Net effect: toggling ONE child while filtered can leave the header's `.enabled`
  // stuck at `true` even though only 1 of many children is actually ticked. We must
  // never trust `choice.enabled` on a category header - only its children's own flags.
  const choices = [
    {
      name: "acciones",
      enabled: true, // erroneously left `true` by the enquirer quirk described above
      choices: [
        { name: "acciones::GGAL", enabled: true },
        { name: "acciones::YPFD", enabled: false },
        { name: "acciones::AAPL", enabled: false }
      ]
    },
    { name: UPDATE_SYMBOL_LIST_CHOICE, enabled: false }
  ];

  const shape = buildSymbolSelectionShape(choices);
  assert.deepEqual(shape, {
    categories: [],
    symbols: [{ category: "acciones", simbolo: "GGAL" }],
    updateRequested: false,
    backRequested: false
  });
});

test("buildSymbolSelectionShape flags updateRequested when the special row is enabled, and excludes it from picks", () => {
  const choices = [
    { name: "acciones", enabled: false, choices: [{ name: "acciones::GGAL", enabled: false }] },
    { name: UPDATE_SYMBOL_LIST_CHOICE, enabled: true }
  ];

  const shape = buildSymbolSelectionShape(choices);
  assert.deepEqual(shape, { categories: [], symbols: [], updateRequested: true, backRequested: false });
});

test("buildSymbolSelectionShape flags backRequested when the 'volver al menu' row is enabled, and excludes it from picks", () => {
  const choices = [
    { name: "acciones", enabled: false, choices: [{ name: "acciones::GGAL", enabled: false }] },
    { name: BACK_CHOICE, enabled: true },
    { name: UPDATE_SYMBOL_LIST_CHOICE, enabled: false }
  ];

  const shape = buildSymbolSelectionShape(choices);
  assert.deepEqual(shape, { categories: [], symbols: [], updateRequested: false, backRequested: true });
});

test("formatSelectionSummary lists fully-selected categories by name and partial ones by ticker", () => {
  const summary = formatSelectionSummary({
    categories: ["acciones", "cedears"],
    symbols: [{ category: "bonos", simbolo: "AL30" }, { category: "bonos", simbolo: "GD30" }]
  });

  assert.equal(summary, "Acciones, CEDEARs, AL30, GD30");
});

test("formatSelectionSummary handles a category-only selection", () => {
  assert.equal(formatSelectionSummary({ categories: ["acciones"], symbols: [] }), "Acciones");
});

test("formatSelectionSummary handles a ticker-only selection", () => {
  assert.equal(
    formatSelectionSummary({ categories: [], symbols: [{ category: "bonos", simbolo: "AL30" }] }),
    "AL30"
  );
});

function makeLastSelectionService(initial) {
  let stored = initial || null;
  return {
    reads: 0,
    writes: [],
    readSelection() {
      this.reads += 1;
      return stored;
    },
    writeSelection(selection) {
      stored = selection;
      this.writes.push(selection);
    }
  };
}

test("promptForSymbolSelectionWithReuse skips the confirm prompt and goes straight to the picker when there is no prior selection", async () => {
  const lastSelectionService = makeLastSelectionService(null);
  const cache = { categories: {} };
  const confirmReuse = async () => {
    throw new Error("should not be called");
  };
  const selectSymbols = async (args) => {
    assert.equal(args.cache, cache);
    assert.equal(args.initialSelection, undefined);
    return { categories: ["acciones"], symbols: [] };
  };

  const result = await promptForSymbolSelectionWithReuse({
    cache,
    lastSelectionService,
    selectSymbols,
    confirmReuse
  });

  assert.deepEqual(result, { categories: ["acciones"], symbols: [] });
  assert.deepEqual(lastSelectionService.writes, [{ categories: ["acciones"], symbols: [] }]);
});

test("promptForSymbolSelectionWithReuse returns the stored selection without opening the picker when the user confirms reuse", async () => {
  const stored = { categories: ["acciones"], symbols: [] };
  const lastSelectionService = makeLastSelectionService(stored);
  const selectSymbols = async () => {
    throw new Error("picker should not open when reusing the last selection");
  };
  const confirmReuse = async (summary) => {
    assert.equal(summary, "Acciones");
    return true;
  };

  const result = await promptForSymbolSelectionWithReuse({
    cache: { categories: {} },
    lastSelectionService,
    selectSymbols,
    confirmReuse
  });

  assert.deepEqual(result, stored);
  assert.deepEqual(lastSelectionService.writes, []);
});

test("promptForSymbolSelectionWithReuse opens the picker/menu completely blank (not pre-checked) when the user declines reuse", async () => {
  const stored = { categories: ["acciones"], symbols: [] };
  const lastSelectionService = makeLastSelectionService(stored);
  const confirmReuse = async () => false;
  const selectSymbols = async (args) => {
    // Declining reuse discards the old selection entirely - no initialSelection at all,
    // same as a first-ever run. This was a deliberate product decision (not the original
    // ticket 05 spec, which pre-checked as a starting point) after real usage showed the
    // pre-checked behavior read as "my selection didn't get cleared" to users.
    assert.equal(args.initialSelection, undefined);
    return { categories: [], symbols: [{ category: "cedears", simbolo: "AAPL" }] };
  };

  const result = await promptForSymbolSelectionWithReuse({
    cache: { categories: {} },
    lastSelectionService,
    selectSymbols,
    confirmReuse
  });

  assert.deepEqual(result, { categories: [], symbols: [{ category: "cedears", simbolo: "AAPL" }] });
  assert.deepEqual(lastSelectionService.writes, [{ categories: [], symbols: [{ category: "cedears", simbolo: "AAPL" }] }]);
});

test("buildPresetMenuChoices lists categories and navigation choices", () => {
  const choices = buildPresetMenuChoices(CACHE);
  assert.deepEqual(
    choices.map((c) => c.name),
    [TODOS_CHOICE, "acciones", "cedears", CUSTOM_CHOICE, MAIN_MENU_CHOICE, EXIT_CHOICE]
  );
});

test("buildPresetMenuChoices omits categories with zero symbols", () => {
  const choices = buildPresetMenuChoices(CACHE);
  assert.ok(!choices.some((c) => c.name === "fci" || c.name === "etfs"));
});

test("resolvePresetMenuSelection routes to custom when Custom is ticked, ignoring any other ticks", () => {
  const result = resolvePresetMenuSelection(["acciones", CUSTOM_CHOICE], ["acciones", "cedears"]);
  assert.deepEqual(result, { mode: "custom" });
});

test("resolvePresetMenuSelection gives exit and main-menu actions priority over category picks", () => {
  assert.deepEqual(resolvePresetMenuSelection(["acciones", MAIN_MENU_CHOICE], ["acciones", "cedears"]), {
    mode: "main"
  });
  assert.deepEqual(resolvePresetMenuSelection(["acciones", EXIT_CHOICE], ["acciones", "cedears"]), { mode: "exit" });
});

test("resolvePresetMenuSelection expands Todos to every category, ignoring individual ticks", () => {
  const result = resolvePresetMenuSelection(["acciones", TODOS_CHOICE], ["acciones", "cedears"]);
  assert.deepEqual(result, { mode: "categories", categories: ["acciones", "cedears"] });
});

test("resolvePresetMenuSelection returns exactly the ticked categories when neither Todos nor Custom is ticked", () => {
  const result = resolvePresetMenuSelection(["cedears"], ["acciones", "cedears"]);
  assert.deepEqual(result, { mode: "categories", categories: ["cedears"] });
});

test("resolvePresetMenuSelection returns an empty category list when nothing is ticked", () => {
  const result = resolvePresetMenuSelection([], ["acciones", "cedears"]);
  assert.deepEqual(result, { mode: "categories", categories: [] });
});

test("promptForInstrumentSelection always shows the preset menu first", async () => {
  const presetMenu = async () => ({ mode: "categories", categories: ["acciones"] });
  const customPicker = async () => {
    throw new Error("should not open the custom picker");
  };

  const result = await promptForInstrumentSelection({ cache: CACHE, presetMenu, customPicker });
  assert.deepEqual(result, { categories: ["acciones"], symbols: [] });
});

test("promptForInstrumentSelection returns navigation requests without treating them as instruments", async () => {
  const mainResult = await promptForInstrumentSelection({
    cache: CACHE,
    presetMenu: async () => ({ mode: "main" })
  });
  const exitResult = await promptForInstrumentSelection({
    cache: CACHE,
    presetMenu: async () => ({ mode: "exit" })
  });

  assert.deepEqual(mainResult, { mainMenu: true });
  assert.deepEqual(exitResult, { exit: true });
});

test("promptForInstrumentSelection opens the custom picker (allowBack) when the menu result is 'custom'", async () => {
  const presetMenu = async () => ({ mode: "custom" });
  const customPicker = async (args) => {
    assert.equal(args.allowBack, true);
    return { categories: [], symbols: [{ category: "acciones", simbolo: "GGAL" }] };
  };

  const result = await promptForInstrumentSelection({ cache: CACHE, presetMenu, customPicker });
  assert.deepEqual(result, { categories: [], symbols: [{ category: "acciones", simbolo: "GGAL" }] });
});

test("promptForInstrumentSelection returns to the preset menu when the custom picker reports 'back'", async () => {
  let menuCalls = 0;
  const presetMenu = async () => {
    menuCalls += 1;
    return menuCalls === 1 ? { mode: "custom" } : { mode: "categories", categories: ["bonos"] };
  };
  let customCalls = 0;
  const customPicker = async () => {
    customCalls += 1;
    return { back: true };
  };

  const result = await promptForInstrumentSelection({ cache: CACHE, presetMenu, customPicker });

  assert.equal(menuCalls, 2);
  assert.equal(customCalls, 1);
  assert.deepEqual(result, { categories: ["bonos"], symbols: [] });
});

test("promptForInstrumentSelection keeps a refreshed cache when backing out to the preset menu", async () => {
  const staleCache = { categories: { acciones: [{ simbolo: "OLD", descripcion: "Old" }] } };
  const freshCache = { categories: { acciones: [{ simbolo: "NEW", descripcion: "New" }] } };
  const menuCaches = [];
  let menuCalls = 0;
  const presetMenu = async ({ cache }) => {
    menuCaches.push(cache);
    menuCalls += 1;
    return menuCalls === 1 ? { mode: "custom" } : { mode: "categories", categories: ["acciones"] };
  };
  const customPicker = async ({ cache, onUpdateSymbolList }) => {
    assert.equal(cache, staleCache);
    assert.equal(await onUpdateSymbolList(), freshCache);
    return { back: true };
  };

  const result = await promptForInstrumentSelection({
    cache: staleCache,
    onUpdateSymbolList: async () => freshCache,
    presetMenu,
    customPicker
  });

  assert.deepEqual(result, { categories: ["acciones"], symbols: [] });
  assert.deepEqual(menuCaches, [staleCache, freshCache]);
});

test("promptForInstrumentSelection throws without a symbol cache", async () => {
  await assert.rejects(() => promptForInstrumentSelection({ cache: null }), /No hay caché de símbolos/);
});
