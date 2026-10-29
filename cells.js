// Average RGBA per grid square from an image sampled at (cols*k) x (rows*k); colour is alpha-weighted.
export function cellAverages(data, cols, rows, k) {
  const w = cols * k;
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let R = 0, G = 0, B = 0, A = 0;
      for (let y = r * k; y < (r + 1) * k; y++)
        for (let x = c * k; x < (c + 1) * k; x++) {
          const i = (y * w + x) * 4;
          const a = data[i + 3];
          R += data[i] * a; G += data[i + 1] * a; B += data[i + 2] * a; A += a;
        }
      out.push(A ? [R / A, G / A, B / A, A / (k * k)] : [0, 0, 0, 0]);
    }
  return out;
}

// A square is part of the design when it's opaque and differs enough from the background (the corner squares).
export function inkMask(cells, cols, rows, threshold) {
  const corners = [0, cols - 1, (rows - 1) * cols, rows * cols - 1].map((i) => cells[i]);
  const bg = [0, 1, 2, 3].map((j) => corners.reduce((s, p) => s + p[j], 0) / 4);
  return cells.map(([r, g, b, a]) =>
    a >= 128 && (bg[3] < 128 || Math.hypot(r - bg[0], g - bg[1], b - bg[2]) / 441.7 > threshold));
}
