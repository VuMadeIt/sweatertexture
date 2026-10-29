const canvas = document.getElementById("stitch");
const ctx = canvas.getContext("2d", { alpha: false });
const colsInput = document.getElementById("cols");
const softInput = document.getElementById("soft");
const colsVal = document.getElementById("cols-val");

const stitchImg = new Image();
stitchImg.src = "./assets/stitch-unit.jpg";

function drawStitchCell(x, y, size, softness) {
  const pad = size * 0.06;
  const w = size - pad * 2;
  const h = size - pad * 2;

  ctx.save();
  ctx.translate(x + pad, y + pad);

  // Soft halo so edges feather like the airbrush ref
  ctx.shadowColor = `rgba(255, 255, 255, ${0.18 * softness})`;
  ctx.shadowBlur = 18 * softness;

  ctx.globalAlpha = 0.92 + 0.08 * Math.min(softness, 1);
  ctx.drawImage(stitchImg, 0, 0, w, h);

  // Vertical fiber streaks (the texture from the detailed ref)
  const streak = ctx.createLinearGradient(0, 0, w * 0.15, 0);
  streak.addColorStop(0, "rgba(255,255,255,0)");
  streak.addColorStop(0.5, `rgba(255,255,255,${0.07 * softness})`);
  streak.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "soft-light";
  for (let i = 0; i < 7; i++) {
    const sx = (w * (i + 0.5)) / 7;
    ctx.fillStyle = streak;
    ctx.fillRect(sx - w * 0.04, 0, w * 0.08, h);
  }

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
      // Offset odd rows slightly for a knit-row feel
      const ox = row % 2 === 1 ? size * 0.08 : 0;
      drawStitchCell(col * size + ox, row * size, size, softness);
    }
  }
}

function ready() {
  if (!stitchImg.complete) {
    stitchImg.addEventListener("load", render, { once: true });
  } else {
    render();
  }
}

colsInput.addEventListener("input", render);
softInput.addEventListener("input", render);
ready();
