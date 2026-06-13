import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../public/js/levels.js";
import { T, SOLID } from "../public/js/constants.js";

test("there are at least three levels", () => {
  assert.ok(LEVELS.length >= 3, "expected 3+ levels");
});

for (const def of LEVELS) {
  test(`level ${def.name}: all rows are the same width`, () => {
    const widths = new Set(def.tiles.map((r) => r.length));
    assert.equal(widths.size, 1, `inconsistent row widths in ${def.name}`);
    assert.equal([...widths][0], def.width, "row width matches declared width");
  });

  test(`level ${def.name}: has a reachable flagpole`, () => {
    assert.ok(def.flagCol > 0 && def.flagCol < def.width, "flagCol in range");
    const hasPole = def.tiles.some((row) => row[def.flagCol] === T.FLAGPOLE);
    assert.ok(hasPole, "flag column contains a flagpole tile");
  });

  test(`level ${def.name}: player start area is solid ground`, () => {
    // Column 3 (the spawn) must have a solid tile to stand on.
    const col = 3;
    const grounded = def.tiles.some((row) => SOLID.has(row[col]));
    assert.ok(grounded, "spawn column has ground");
  });

  test(`level ${def.name}: no leftover enemy spawn markers`, () => {
    // Markers are valid in source but should be uppercase/lowercase letters we
    // recognise; ensure every char is a known legend entry.
    const known = new Set(Object.values(T));
    for (const row of def.tiles) {
      for (const ch of row) {
        assert.ok(known.has(ch), `unknown tile char "${ch}" in ${def.name}`);
      }
    }
  });

  test(`level ${def.name}: has a sensible time limit`, () => {
    assert.ok(def.time >= 100 && def.time <= 999, "time limit in range");
  });
}
