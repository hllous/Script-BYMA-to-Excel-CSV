// Spike: does plain enquirer AutoComplete (multiple:true) + nested `choices`
// give us "category row toggles all children" + "real-time search" together,
// with NO subclassing? Drives the prompt via .keypress() directly since
// there's no real TTY in this sandbox.
"use strict";

const { AutoComplete } = require("enquirer");
const { EventEmitter } = require("events");

function fakeStdin() {
  const emitter = new EventEmitter();
  emitter.isTTY = true;
  emitter.setRawMode = () => {};
  emitter.resume = () => {};
  emitter.pause = () => {};
  return emitter;
}

function fakeStdout() {
  return { write() {} };
}

async function main() {
  const prompt = new AutoComplete({
    name: "symbols",
    message: "Elegi instrumentos",
    multiple: true,
    limit: 20,
    stdin: fakeStdin(),
    stdout: fakeStdout(),
    choices: [
      {
        name: "Acciones",
        choices: [
          { name: "GGAL" },
          { name: "YPFD" },
          { name: "PAMP" },
        ],
      },
      {
        name: "Cedears",
        choices: [
          { name: "AAPL" },
          { name: "MSFT" },
        ],
      },
      { name: "Update symbol list from IOL" },
    ],
  });

  // Prevent run() from blocking on real input; we'll drive keypress()
  // and submit() manually instead of calling prompt.run().
  await prompt.initialize();

  const send = async (s, event = {}) => prompt.keypress(s, event);

  console.log("--- initial state ---");
  dump(prompt);

  console.log("\n--- type 'GG' to filter ---");
  await send("G");
  await send("G");
  dump(prompt);
  console.log(
    "visible names:",
    prompt.visible.map((c) => c.name)
  );

  console.log("\n--- clear filter (backspace x2) ---");
  await send("\x7f");
  await send("\x7f");
  dump(prompt);

  console.log("\n--- move focus to 'Acciones' category row, press space ---");
  prompt.index = prompt.choices.findIndex((c) => c.name === "Acciones");
  await send(" ");
  console.log(
    "Acciones enabled:",
    prompt.find("Acciones").enabled,
    "children enabled:",
    prompt.find("Acciones").choices.map((c) => `${c.name}=${c.enabled}`)
  );

  console.log("\n--- uncheck just GGAL under Acciones ---");
  prompt.index = prompt.choices.findIndex((c) => c.name === "GGAL");
  await send(" ");
  console.log(
    "Acciones enabled (should be false, partial):",
    prompt.find("Acciones").enabled
  );
  console.log(
    "children:",
    prompt.find("Acciones").choices.map((c) => `${c.name}=${c.enabled}`)
  );

  console.log("\n--- select individual AAPL (Cedears) without full category ---");
  prompt.index = prompt.choices.findIndex((c) => c.name === "AAPL");
  await send(" ");

  console.log("\n--- search while a partial selection exists: type 'a' ---");
  await send("a");
  console.log(
    "visible after typing 'a':",
    prompt.visible.map((c) => c.name)
  );
  console.log(
    "selected (enabled) names, should be stable across filtering:",
    prompt.selected.map((c) => c.name)
  );

  console.log("\n--- final selected/enabled set ---");
  console.log(prompt.selected.map((c) => c.name));

  process.exit(0);
}

function dump(prompt) {
  console.log("input:", JSON.stringify(prompt.input));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
