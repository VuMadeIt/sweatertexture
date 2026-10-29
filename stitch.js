const canvas = document.getElementById("stitch");
const ctx = canvas.getContext("2d", { alpha: false });
const colsInput = document.getElementById("cols");
const softInput = document.getElementById("soft");
const colsVal = document.getElementById("cols-val");

const stitchImg = new Image();
stitchImg.decoding = "async";
stitchImg.src = "./assets/stitch-unit.jpg";

function fiberPass(w, h, softness) {
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  for (let i = 0; i < 9; i++) {
    const x = ((i + 0.5) / 9) * w;
    const grad = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
    const a = 0.05 * softness * (i % 2 === 0 ? 1 : 0.55);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 8, 0, 16, h);
  }
  ctx.restore();
}

function drawStitchCell(x, y, size, softness) {
  const pad = size * 0.02;
  const w = size - pad * 2;
  const h = size - pad * 2;

  ctx.save();
  ctx.translate(x + pad, y + pad);
  ctx.shadowColor = `rgba(245, 240, 232, ${0.2 * softness})`;
  ctx.shadowBlur = 20 * softness;
  // Full unit asset: soft airbrush texture + complete uncovered shape
  ctx.drawImage(stitchImg, 0, 0, w, h);
  fiberPass(w, h, softness);
  ctx.restore();
}

function render() {
  const cols = Number(colsInput.value);
  const softness = Number(softInput.value);
  colsVal.textContent = `${cols}×${cols}`;

  const size = canvas.width / cols;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      const ox = cols > 1 && row % 2 === 1 ? size * 0.1 : 0;
      drawStitchCell(col * size + ox, row * size, size, softness);
    }
  }
}

function ready() {
  if (stitchImg.complete && stitchImg.naturalWidth) render();
  else stitchImg.addEventListener("load", render, { once: true });
}

colsInput.addEventListener("input", render);
softInput.addEventListener("input", render);
ready();
