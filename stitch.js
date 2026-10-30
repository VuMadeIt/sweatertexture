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

// Seamless stockinette photo, multiply-tinted per colour then stamped on the grid.
const knitTex = new Image();
knitTex.decoding = "async";
knitTex.src = "./assets/knit-stockinette.png";
knitTex.decode().then(() => { tinted.clear(); schedule(); }).catch(() => {});

const tinted = new Map();
function tintedKnit(color) {
  if (tinted.has(color)) return tinted.get(color);
  const c = document.createElement("canvas");
  if (!knitTex.naturalWidth) {
    c.width = c.height = 8;
    const g = c.getContext("2d");
    g.fillStyle = color;
    g.fillRect(0, 0, 8, 8);
  } else {
    c.width = knitTex.naturalWidth;
    c.height = knitTex.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(knitTex, 0, 0);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
  }
  tinted.set(color, c);
  return c;
}

// One grid square of seamless stockinette (pattern scaled so V-columns read at stitch size).
function stampKnit(tex, x, y, cell) {
  const pat = ctx.createPattern(tex, "repeat");
  if (!pat) {
    ctx.fillStyle = "#888";
    ctx.fillRect(x, y, cell + 1, cell + 1);
    return;
  }
  // ~6 stockinette columns across the texture → one column ≈ cell px
  const scale = (cell * 6) / Math.max(tex.width, 1);
  if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(scale, scale));
  ctx.fillStyle = pat;
  ctx.fillRect(x, y, cell + 1, cell + 1);
}

const hex = (rgb) => "#" + rgb.map((v) => Math.min(255, Math.round(v / 24) * 24).toString(16).padStart(2, "0")).join("");

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
  }

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!ink[i] && mode !== "knit") continue;
      const color = !ink[i] ? ui.bg.value : ui.useImage.checked ? hex(cells[i].slice(0, 3)) : ui.color.value;
      stampKnit(tintedKnit(color), c * cell, r * cell, cell);
    }
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
