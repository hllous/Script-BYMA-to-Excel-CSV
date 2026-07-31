// Manual smoke test of the real promptForSymbolSelection() against the real
// seeded data/symbols.json cache. Drives keypresses programmatically since
// there's no real TTY here. Exercises the actual production code path
// (buildSymbolPickerChoices / buildSymbolSelectionShape / promptForSymbolSelection),
// not a reimplementation.
"use strict";

const { EventEmitter } = require("events");

function fakeStdin() {
  const emitter = new EventEmitter();
  emitter.isTTY = true;
  emitter.setRawMode = () => {};
  emitter.resume = () => {};
  emitter.pause = () => {};
  return emitter;
}

// `onRun` is a stock enquirer hook (see Prompt.initialize in lib/prompt.js),
// used here to capture the live prompt instance after each (re)open so we
// can drive it with synthetic keypresses. `stdin`/`stdout` overrides avoid
// needing a real TTY.
function makePromptOverrides(onPromptCreated) {
  return {
    stdin: fakeStdin(),
    stdout: { write() {} },
    onRun: onPromptCreated
  };
}

const cache = require("../../data/symbols.json");
const { promptForSymbolSelection } = require("../../src/interactiveMenu");

const tick = () => new Promise((r) => setImmediate(r));

async function scenarioFilteredSubmitDoesNotDropOutOfFilterPicks() {
  console.log("=== Scenario 1: submit while a search filter is still active ===");
  let prompt;
  const promptOverrides = makePromptOverrides((p) => (prompt = p));

  const resultPromise = promptForSymbolSelection({ cache, promptOverrides });
  await tick();

  // toggle the whole "acciones" category on
  prompt.index = prompt.choices.findIndex((c) => c.name === "acciones");
  await prompt.keypress(" ");
  await tick();

  // toggle one individual cedears symbol on (independent of any category)
  const cedearChoice = prompt.choices.find((c) => c.name === "cedears");
  const firstCedear = cedearChoice.choices[0];
  prompt.index = prompt.choices.findIndex((c) => c.name === firstCedear.name);
  await prompt.keypress(" ");
  await tick();

  // type a filter that hides both picks above, and confirm it narrowed the view
  await prompt.keypress("Y");
  await prompt.keypress("P");
  await tick();
  const visibleDuringFilter = prompt.visible.map((c) => c.name);
  console.log("Visible while filtering 'YP':", visibleDuringFilter);
  if (visibleDuringFilter.includes("cedears::" + firstCedear.name.split("::")[1])) {
    throw new Error("Test setup invalid: cedears pick should be hidden by the 'YP' filter");
  }

  // Submit WITHOUT clearing the filter. Regression check: this must not
  // drop the "acciones"/cedears picks made above just because they're
  // outside the currently-visible filtered subset.
  await prompt.keypress("\r", { name: "return" });

  const result = await resultPromise;
  console.log("Result (submitted while filtered):", JSON.stringify(result, null, 2));

  const expectedCedearSimbolo = firstCedear.name.split("::")[1];
  if (!result.categories.includes("acciones")) {
    throw new Error("FAILED: 'acciones' category pick was dropped by submitting while filtered");
  }
  if (!result.symbols.some((s) => s.category === "cedears" && s.simbolo === expectedCedearSimbolo)) {
    throw new Error(`FAILED: cedears::${expectedCedearSimbolo} pick was dropped by submitting while filtered`);
  }
  console.log("Scenario 1 PASSED\n");
}

async function scenarioUpdateSymbolListReopensWithFreshDataAndPreservesSelection() {
  console.log("=== Scenario 2: 'Update symbol list from IOL' reopens with fresh data ===");
  const prompts = [];
  const promptOverrides = makePromptOverrides((p) => prompts.push(p));

  let refreshCallCount = 0;
  const fakeRefreshedCache = {
    categories: {
      ...cache.categories,
      acciones: [...cache.categories.acciones, { simbolo: "NEWX", descripcion: "Nuevo simbolo" }]
    }
  };

  const resultPromise = promptForSymbolSelection({
    cache,
    onUpdateSymbolList: async () => {
      refreshCallCount += 1;
      return fakeRefreshedCache;
    },
    promptOverrides
  });
  await tick();
  const round1 = prompts[0];

  round1.index = round1.choices.findIndex((c) => c.name === "acciones");
  await round1.keypress(" ");
  await tick();

  round1.index = round1.choices.findIndex((c) => c.name === "__update_symbol_list__");
  await round1.keypress(" ");
  await tick();
  await round1.keypress("\r", { name: "return" });
  await tick();

  const round2 = prompts[1];
  if (!round2 || round2 === round1) {
    throw new Error("FAILED: picker did not reopen after 'update symbol list'");
  }

  const accionesRound2 = round2.choices.find((c) => c.name === "acciones");
  if (!accionesRound2.enabled) {
    throw new Error("FAILED: previous full-category selection was not preserved into round 2");
  }
  const newxChoice = accionesRound2.choices.find((c) => c.name === "acciones::NEWX");
  if (!newxChoice) {
    throw new Error("FAILED: round 2 did not use the fresh (refreshed) cache");
  }

  await round2.keypress("\r", { name: "return" });
  const result = await resultPromise;
  console.log("Result (after update+reopen):", JSON.stringify(result, null, 2));
  console.log("refreshSymbolCache invocations:", refreshCallCount);

  if (refreshCallCount !== 1) throw new Error("FAILED: expected exactly 1 refresh call");
  if (!result.categories.includes("acciones")) throw new Error("FAILED: acciones category not in final result");
  console.log("Scenario 2 PASSED\n");
}

async function main() {
  await scenarioFilteredSubmitDoesNotDropOutOfFilterPicks();
  await scenarioUpdateSymbolListReopensWithFreshDataAndPreservesSelection();
  console.log("All smoke scenarios PASSED");
  process.exit(0);
}

main().catch((err) => {
  console.error("Smoke test FAILED:", err);
  process.exit(1);
});
