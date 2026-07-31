"use strict";

// Tiny 6-row block font, built programmatically (not hand-typed as one long
// string) so every letter's columns stay aligned and there's no risk of a
// stray character shifting the art. '#' is used instead of a unicode block
// glyph so it renders correctly regardless of the terminal's codepage.
const FONT = {
  B: ["####.", "#...#", "####.", "#...#", "#...#", "####."],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#.."],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#"],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#"],
  " ": [".....", ".....", ".....", ".....", ".....", "....."]
};

function renderBigText(text) {
  const letters = text
    .toUpperCase()
    .split("")
    .map((ch) => FONT[ch] || FONT[" "]);

  const rows = [];
  for (let row = 0; row < 6; row++) {
    rows.push(letters.map((letter) => letter[row]).join(" ").replace(/\./g, " "));
  }
  return rows.join("\n");
}

function printHomeBanner() {
  console.log("\n" + renderBigText("BYMA"));
  console.log("        to CSV / XLSX\n");
}

module.exports = { renderBigText, printHomeBanner };
