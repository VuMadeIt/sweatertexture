import { cellAverages, inkMask } from "./cells.js";

const $ = (id) => document.getElementById(id);
const canvas = $("stitch");
const ctx = canvas.getContext("2d");
const ui = {
  file: $("file"), size: $("size"), sizeVal: $("size-val"), threshold: $("threshold"),
  color: $("color"), useImage: $("use-image"), bgMode: $("bg-mode"), bg: $("bg"), status: $("status"),
};

const LONG_SIDE = 3000; // same canvas as the Procreate tutorial
const SAMPLES = 4; // pixels sampled per grid square, per axis
let source = demoSource();

function demoSource() {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 600;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#000";
  g.font = "bold 330px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("Noel", 600, 320);
  return c;
}

function heartPath(g, w, h) {
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.26);
  g.bezierCurveTo(w * 0.5, h * 0.02, w * 0.02, h * -0.02, w * 0.02, h * 0.32);
  g.bezierCurveTo(w * 0.02, h * 0.6, w * 0.3, h * 0.8, w * 0.5, h * 0.98);
  g.bezierCurveTo(w * 0.7, h * 0.8, w * 0.98, h * 0.6, w * 0.98, h * 0.32);
  g.bezierCurveTo(w * 0.98, h * -0.02, w * 0.5, h * 0.02, w * 0.5, h * 0.26);
  g.closePath();
}

// Airbrush stroke: draw the line off-canvas and keep only its blurred shadow (canvas `filter` isn't in Safari).
const AWAY = 10000;
function airbrush(g, color, width, blur, pts) {
  g.strokeStyle = g.shadowColor = color;
  g.lineWidth = width;
  g.shadowBlur = blur;
  g.shadowOffsetX = AWAY;
  g.beginPath();
  g.moveTo(pts[0] - AWAY, pts[1]);
  g.quadraticCurveTo(pts[2] - AWAY, pts[3], pts[4] - AWAY, pts[5]);
  g.stroke();
  g.shadowOffsetX = 0;
}

// One airbrushed heart stitch, rendered once per colour/size and then stamped.
const sprites = new Map();
function sprite(color, cell) {
  const key = color + cell;
  if (sprites.has(key)) return sprites.get(key);
  const w = cell * 1.1;
  const h = cell * 1.18; // bigger than the grid square, so stitches overlap (spacing under 100%)
  const pad = Math.ceil(cell * 0.2);
  const c = document.createElement("canvas");
  c.width = Math.ceil(w + pad * 2);
  c.height = Math.ceil(h + pad * 2);
  const g = c.getContext("2d");
  g.translate(pad, pad);
  g.lineCap = "round";

  // soft fuzzy edge
  heartPath(g, w, h);
  g.fillStyle = g.shadowColor = color;
  g.shadowBlur = cell * 0.1;
  g.fill();
  g.clip();

  // lit top, shaded towards the tip
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0.28)");
  g.shadowBlur = 0;
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  // yarn strands: from each lobe's top edge, curving down the sides into the middle tip (a V)
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      const lx = 0.06 + t * 0.4; // left-lobe x, mirrored for the right
      const top = 0.3 - Math.sqrt(Math.max(0, 0.235 ** 2 - (lx - 0.26) ** 2));
      const x = 0.5 + side * (0.5 - lx);
      const cx = 0.5 + side * (0.5 - lx) * 0.75;
      airbrush(g, i % 2 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.5)", cell * 0.06, cell * 0.035,
        [x * w, top * h, cx * w, 0.62 * h, (0.5 + side * 0.04) * w, 1.0 * h]);
    }
  }
  // centre valley and inner edge shadow give it depth
  airbrush(g, "rgba(0,0,0,0.4)", cell * 0.07, cell * 0.08, [0.5 * w, 0.2 * h, 0.5 * w, 0.6 * h, 0.5 * w, h]);
  g.save();
  g.translate(-AWAY, 0);
  heartPath(g, w, h);
  g.restore();
  g.strokeStyle = g.shadowColor = "rgba(0,0,0,0.3)";
  g.lineWidth = cell * 0.1;
  g.shadowBlur = cell * 0.1;
  g.shadowOffsetX = AWAY;
  g.stroke();

  const s = { c, ox: -(pad + w / 2), oy: -(pad + h / 2) };
  sprites.set(key, s);
  return s;
}

const hex = (rgb) => "#" + rgb.map((v) => Math.min(255, Math.round(v / 24) * 24).toString(16).padStart(2, "0")).join("");
const noise = (r, c, n) => { const s = Math.sin(r * 127.1 + c * 311.7 + n * 74.7) * 43758.5453; return s - Math.floor(s) - 0.5; };

function render(bgOnly = false) {
  const cell = Number(ui.size.value);
  ui.sizeVal.textContent = `${cell}px`;
  const scale = LONG_SIDE / Math.max(source.width, source.height);
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const cols = Math.ceil(canvas.width / cell);
  const rows = Math.ceil(canvas.height / cell);

  // the 2D grid: sample the image so each square gets its average colour
  const small = document.createElement("canvas");
  small.width = cols * SAMPLES;
  small.height = rows * SAMPLES;
  const sg = small.getContext("2d", { willReadFrequently: true });
  sg.imageSmoothingQuality = "high";
  sg.drawImage(source, 0, 0, small.width, small.height);
  const cells = cellAverages(sg.getImageData(0, 0, small.width, small.height).data, cols, rows, SAMPLES);
  const ink = bgOnly ? cells.map(() => false) : inkMask(cells, cols, rows, Number(ui.threshold.value));

  const mode = bgOnly ? "knit" : ui.bgMode.value;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (mode !== "none") {
    ctx.fillStyle = ui.bg.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (mode === "knit") {
      ctx.fillStyle = "rgba(0,0,0,0.35)"; // gaps between stitches read darker
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!ink[i] && mode !== "knit") continue;
      const color = !ink[i] ? ui.bg.value : ui.useImage.checked ? hex(cells[i].slice(0, 3)) : ui.color.value;
      const s = sprite(color, cell);
      // small hand-stamped wobble
      const a = noise(r, c, 1) * 0.12;
      ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a),
        (c + 0.5 + noise(r, c, 2) * 0.05) * cell, (r + 0.5 + noise(r, c, 3) * 0.05) * cell);
      ctx.drawImage(s.c, s.ox, s.oy);
    }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
}

const say = (msg) => (ui.status.textContent = msg);
const pngBlob = () => new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

ui.file.addEventListener("change", async () => {
  const f = ui.file.files[0];
  if (!f) return;
  const img = new Image();
  img.src = URL.createObjectURL(f);
  try {
    await img.decode();
    source = img;
    say("");
    schedule();
  } catch {
    say("Couldn't read that image. Try a PNG or JPG.");
  }
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob() })]);
    say("Copied to clipboard.");
  } catch (e) {
    say(`Copy failed (${e.message}). Use Download instead.`);
  }
});

async function download(name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await pngBlob());
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("download").addEventListener("click", () => download("sweater.png"));

// Plain knit in the background colour, no design.
$("download-bg").addEventListener("click", async () => {
  render(true);
  await download("sweater-background.png");
  render();
});

// Pasted/typed colours: "#a3152a", "a3152a", "#fff", "red", "rgb(163 21 42)"… -> "#rrggbb", or null if not a colour.
const probe = document.createElement("canvas").getContext("2d");
function toHex(text) {
  const t = text.trim();
  const v = CSS.supports("color", t) ? t : CSS.supports("color", "#" + t) ? "#" + t : null;
  if (!v) return null;
  probe.fillStyle = "#000"; // keywords like "inherit" pass CSS.supports but leave fillStyle unchanged
  probe.fillStyle = v;
  const s = probe.fillStyle; // "#rrggbb", or "rgba(r, g, b, a)" when the colour has alpha (dropped)
  return s.startsWith("#") ? s : "#" + s.match(/\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("");
}

for (const picker of [ui.color, ui.bg]) {
  const text = $(`${picker.id}-hex`);
  picker.addEventListener("input", () => { text.value = picker.value; text.removeAttribute("aria-invalid"); });
  text.addEventListener("input", () => {
    const hex = toHex(text.value);
    text.setAttribute("aria-invalid", String(!hex));
    if (hex) { picker.value = hex; schedule(); }
  });
  text.addEventListener("change", () => { text.value = picker.value; text.removeAttribute("aria-invalid"); });
}

for (const el of [ui.size, ui.threshold, ui.color, ui.useImage, ui.bgMode, ui.bg]) el.addEventListener("input", schedule);
render();
