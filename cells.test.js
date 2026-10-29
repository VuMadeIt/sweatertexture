import { test } from "node:test";
import assert from "node:assert/strict";
import { cellAverages, inkMask } from "./cells.js";

// 3x3 grid, 2px per square, pixel colour chosen by which square it's in
function image(px) {
  const d = new Uint8ClampedArray(6 * 6 * 4);
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 6; x++) d.set(px(Math.floor(x / 2), Math.floor(y / 2), x), (y * 6 + x) * 4);
  return d;
}

test("only the square that differs from a white background is ink", () => {
  const cells = cellAverages(image((c, r) => (c === 1 && r === 1 ? [200, 0, 0, 255] : [255, 255, 255, 255])), 3, 3, 2);
  assert.deepEqual(inkMask(cells, 3, 3, 0.25), [false, false, false, false, true, false, false, false, false]);
});

test("transparent background: any mostly-opaque square is ink, colour ignores transparent pixels", () => {
  const cells = cellAverages(image((c, r, x) => (c === 1 && r === 1 ? (x % 2 ? [0, 0, 0, 0] : [0, 0, 255, 255]) : [0, 0, 0, 0])), 3, 3, 2);
  assert.deepEqual(cells[4], [0, 0, 255, 127.5]);
  assert.equal(inkMask(cells, 3, 3, 0.25)[4], false); // half-covered square is below the 50% cut
  cells[4][3] = 255;
  assert.deepEqual(inkMask(cells, 3, 3, 0.25), [false, false, false, false, true, false, false, false, false]);
});
