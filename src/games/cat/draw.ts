/**
 * Draws the first-letter Game's scene from the model's state, in the
 * model's logical coordinates (SCENE): sky, the town far off, the perches
 * and the cat. The letter signs are DOM buttons over the canvas
 * (CatView.tsx), placed with `signCentre`. Drawing only: nothing here
 * changes the state.
 */
import { SCENE, type CatState, type CelebratedWord, type Perch } from "./model";

const { width: W, height: H, ground: GROUND } = SCENE;

/** How long the Challenge Celebration's sign lasts. */
export const SIGN_SECONDS = 1.8;

/**
 * The sign's top edge hangs this far below the perch's top, so a sign made
 * bigger for small fingers grows downward and never hides the cat's seat.
 */
const SIGN_BELOW_TOP = 18;

const INK = "#22302a";

/** How far a perch is drawn below where it stands, while it sinks or rises. */
const sunk = (perch: Perch) => (1 - perch.rise) * (GROUND - perch.top + 20);

/** Where a perch's letter sign hangs (the middle of its top edge), in scene pixels, and how much of it shows. */
export function signPlace(perch: Perch): { x: number; y: number; shown: number } {
  return { x: perch.x, y: perch.top + SIGN_BELOW_TOP + sunk(perch), shown: perch.rise };
}

/** A fixed pseudo-random number in [0, 1) per seed, so details don't flicker. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

export function drawScene(ctx: CanvasRenderingContext2D, state: CatState): void {
  drawSky(ctx, state);
  drawTown(ctx, state.distance * 0.15, 250, 0.55, "#b9d6e3");
  drawHills(ctx, state.distance * 0.35);
  drawGround(ctx, state.distance);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, GROUND + 2);
  ctx.clip();
  for (const perch of state.perches) drawPerch(ctx, perch);
  ctx.restore();
  if (state.celebrated) drawParty(ctx, state.celebrated, state);
  drawCat(ctx, state);
}

function drawSky(ctx: CanvasRenderingContext2D, state: CatState) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#8fcbe8");
  sky.addColorStop(1, "#e3f4fb");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // The sun, low on the left where the cat is heading.
  ctx.fillStyle = "rgba(245, 197, 66, 0.25)";
  ctx.beginPath();
  ctx.arc(110, 70, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5c542";
  ctx.beginPath();
  ctx.arc(110, 70, 32, 0, Math.PI * 2);
  ctx.fill();

  // Clouds drift slowly with time and travel, wrapping around the scene.
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  for (let i = 0; i < 4; i++) {
    const span = W + 240;
    const x = ((hash(i + 1) * span + state.time * (6 + 4 * i) + state.distance * 0.25) % span) - 120;
    const y = 40 + hash(i + 11) * 70;
    const s = 0.7 + hash(i + 21) * 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 34 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 22 * s, y + 4 * s, 20 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 24 * s, y + 3 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A row of far-off buildings, repeating every 600 px. */
function drawTown(ctx: CanvasRenderingContext2D, offset: number, base: number, scale: number, color: string) {
  ctx.fillStyle = color;
  const period = 600;
  const shift = ((offset % period) + period) % period;
  for (let start = -period + shift; start < W; start += period) {
    let x = start;
    for (let i = 0; x < start + period; i++) {
      const w = (40 + hash(i + 3) * 50) * scale * 1.6;
      const h = (60 + hash(i + 7) * 120) * scale;
      ctx.fillRect(x, base - h, w - 4, h + 80);
      x += w;
    }
  }
}

function drawHills(ctx: CanvasRenderingContext2D, offset: number) {
  ctx.fillStyle = "#a8d78f";
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += 10) {
    const u = (x - offset) / 140;
    ctx.lineTo(x, 268 - 18 * Math.sin(u) - 8 * Math.sin(u * 2.3 + 1));
  }
  ctx.lineTo(W, GROUND);
  ctx.closePath();
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, distance: number) {
  ctx.fillStyle = "#5aa34a";
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = "#4b8f3d";
  ctx.fillRect(0, GROUND, W, 5);
  // Tufts of grass that move with the perches.
  ctx.strokeStyle = "#3f7d33";
  ctx.lineWidth = 2;
  const period = 70;
  const shift = ((distance % period) + period) % period;
  for (let x = -period + shift; x < W + period; x += period) {
    for (const dx of [0, 6, 12]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, GROUND + 22);
      ctx.lineTo(x + dx + 3, GROUND + 12);
      ctx.stroke();
    }
  }
}

function drawPerch(ctx: CanvasRenderingContext2D, perch: Perch) {
  if (perch.rise <= 0) return;
  ctx.save();
  ctx.translate(0, sunk(perch));
  if (perch.kind === "tree") drawTree(ctx, perch);
  else if (perch.kind === "pole") drawPole(ctx, perch);
  else drawBuilding(ctx, perch);
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, { x, top, look }: Perch) {
  ctx.fillStyle = "#8a5a35";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(x - 10, top + 40, 20, GROUND + 40 - top);
  ctx.fill();
  ctx.stroke();
  const greens = ["#4f9e44", "#5fb150", "#3f8f3b"];
  ctx.fillStyle = greens[Math.floor(look * greens.length)];
  ctx.beginPath();
  for (const [cx, cy, r] of [[x, top + 48, 48], [x - 36, top + 66, 32], [x + 36, top + 66, 32]]) {
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, top + 48, 48, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // A few fruit or blossoms.
  ctx.fillStyle = look < 0.5 ? "#e8742b" : "#f2a3b0";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x - 50 + hash(look * 100 + i) * 100, top + 30 + hash(look * 50 + i) * 60, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPole(ctx: CanvasRenderingContext2D, { x, top, look }: Perch) {
  const colours = ["#7c8a9a", "#c94f7c", "#3f8fd8"];
  ctx.fillStyle = colours[Math.floor(look * colours.length)];
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(x - 7, top, 14, GROUND + 40 - top);
  ctx.fill();
  ctx.stroke();
  // The round cap the cat sits on.
  ctx.fillStyle = "#f5c542";
  ctx.beginPath();
  ctx.ellipse(x, top, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawBuilding(ctx: CanvasRenderingContext2D, { x, top, look }: Perch) {
  const walls = ["#f2c38b", "#e7a1a1", "#a9c7e8", "#f4e2a1"];
  const width = 104;
  ctx.fillStyle = walls[Math.floor(look * walls.length)];
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(x - width / 2, top, width, GROUND + 40 - top);
  ctx.fill();
  ctx.stroke();
  // The flat roof.
  ctx.fillStyle = "#7d5b4a";
  ctx.beginPath();
  ctx.rect(x - width / 2 - 6, top - 6, width + 12, 9);
  ctx.fill();
  ctx.stroke();
  // Windows below the letter sign.
  ctx.fillStyle = "#fbfdf9";
  ctx.lineWidth = 2;
  for (let y = top + 100; y < GROUND - 24; y += 38) {
    for (const dx of [-28, 10]) {
      ctx.beginPath();
      ctx.rect(x + dx, y, 18, 22);
      ctx.fill();
      ctx.stroke();
    }
  }
}

/**
 * The cat, sitting on its perch and facing left (where it will jump), in
 * the air stretched out, puzzled after a wrong Choice, and happy while
 * its Challenge is celebrated.
 */
function drawCat(ctx: CanvasRenderingContext2D, state: CatState) {
  const { x, y, airborne, doubt } = state.cat;
  const happy = state.phase === "celebrating";
  const bounce = happy ? -Math.abs(Math.sin(state.time * 9)) * 8 : 0;
  ctx.save();
  ctx.translate(x, y + bounce);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  const fur = "#f29e4c";
  const belly = "#fde3c2";

  // Tail, curling up behind.
  ctx.strokeStyle = fur;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  const wag = Math.sin(state.time * 3) * 6;
  if (airborne) {
    ctx.moveTo(18, -14);
    ctx.quadraticCurveTo(40, -18, 50, -30 + wag);
  } else {
    ctx.moveTo(14, -6);
    ctx.quadraticCurveTo(36, -6, 32, -32 + wag);
  }
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;

  // Body.
  ctx.fillStyle = fur;
  ctx.beginPath();
  if (airborne) ctx.ellipse(0, -18, 26, 12, -0.15, 0, Math.PI * 2);
  else ctx.ellipse(0, -17, 18, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = belly;
  ctx.beginPath();
  if (airborne) ctx.ellipse(-4, -12, 14, 5, -0.15, 0, Math.PI * 2);
  else ctx.ellipse(-5, -12, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Paws: tucked in while sitting, reaching out in a jump.
  ctx.fillStyle = belly;
  for (const px of airborne ? [-30, 24] : [-10, 2]) {
    ctx.beginPath();
    ctx.ellipse(px, airborne ? -12 : -2, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Head, tilting from side to side while puzzled.
  const tilt = doubt > 0 ? Math.sin(state.time * 18) * 0.25 : 0;
  ctx.save();
  ctx.translate(airborne ? -24 : -10, airborne ? -30 : -40);
  ctx.rotate(tilt);
  ctx.fillStyle = fur;
  for (const ex of [-11, 9]) {
    ctx.beginPath();
    ctx.moveTo(ex - 6, -8);
    ctx.lineTo(ex, -24);
    ctx.lineTo(ex + 6, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Eyes: "^ ^" when happy, round otherwise.
  ctx.fillStyle = INK;
  for (const ex of [-6, 5]) {
    ctx.beginPath();
    if (happy) {
      ctx.moveTo(ex - 4, -1);
      ctx.lineTo(ex, -5);
      ctx.lineTo(ex + 4, -1);
      ctx.stroke();
    } else {
      ctx.arc(ex, -2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Nose, mouth and whiskers.
  ctx.fillStyle = "#e5788f";
  ctx.beginPath();
  ctx.moveTo(-3, 4);
  ctx.lineTo(1, 4);
  ctx.lineTo(-1, 7);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(-1 + side * 6, 6);
    ctx.lineTo(-1 + side * 20, 3);
    ctx.moveTo(-1 + side * 6, 8);
    ctx.lineTo(-1 + side * 20, 10);
  }
  ctx.stroke();
  ctx.restore();

  // A question mark over the head while puzzled.
  if (doubt > 0) {
    ctx.fillStyle = INK;
    ctx.globalAlpha = Math.min(1, doubt * 3);
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("?", -10, -74);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** A small seeded generator, so each Celebration's particles stay put from frame to frame. */
function seeded(seed: number) {
  let a = (seed * 0x9e3779b9) >>> 0;
  return (min: number, max: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return min + (((t ^ (t >>> 14)) >>> 0) / 4294967296) * (max - min);
  };
}

const CONFETTI = ["#e8742b", "#f3c12b", "#5aa34a", "#f2a3b0", "#79c2e6"];

/** Stars bursting from where the cat landed, and confetti falling over the scene. */
function drawParty(ctx: CanvasRenderingContext2D, celebrated: CelebratedWord, state: CatState) {
  const t = celebrated.since;
  const rand = seeded(celebrated.number);
  const { x: cx, y: cy } = state.cat;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const v = rand(160, 260);
    const life = rand(0.7, 1.0);
    if (t >= life) continue;
    ctx.globalAlpha = Math.min(1, (life - t) * 2);
    ctx.fillStyle = CONFETTI[i % CONFETTI.length];
    drawStar(ctx, cx + Math.cos(a) * v * t, cy - 30 + Math.sin(a) * v * t + 200 * t * t, 8);
  }
  for (let i = 0; i < 60; i++) {
    const x = rand(0, W);
    const y = rand(-120, -10) + rand(90, 160) * t;
    const life = rand(1.6, 2.2);
    if (t >= life) continue;
    ctx.globalAlpha = Math.min(1, (life - t) * 2);
    ctx.fillStyle = CONFETTI[i % CONFETTI.length];
    ctx.save();
    ctx.translate(x + Math.sin(t * 4 + i) * 10, y);
    ctx.rotate(rand(0, 6) + t * rand(-6, 6));
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
