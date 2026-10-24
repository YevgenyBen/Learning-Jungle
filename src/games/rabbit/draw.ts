/**
 * Draws the rabbit Game's meadow from the model's state, in the model's
 * logical coordinates (WORLD). Shapes and colours are ported from the
 * bunny-hop.html prototype. Drawing only: nothing here changes the state.
 */
import { WORLD, type RabbitState, type Tile } from "./model";

const { width: W, height: H, ground: GROUND } = WORLD;

export interface Fonts {
  /** CSS font-family list for letters (the display font). */
  readonly display: string;
}

const INK = "#22302a";

/** A fixed pseudo-random number in [0, 1) per world slot, so scenery doesn't flicker. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

export function drawMeadow(ctx: CanvasRenderingContext2D, state: RabbitState, fonts: Fonts): void {
  drawSky(ctx, state);
  drawHills(ctx, state.distance, 0.2, 215, 16, 6, 95, 37, "#a8d78f");
  drawHills(ctx, state.distance, 0.45, 248, 12, 5, 70, 29, "#86c470");
  drawGround(ctx, state.distance);
  for (const tile of state.tiles) drawTile(ctx, tile, fonts);
  drawRabbit(ctx, state);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawSky(ctx: CanvasRenderingContext2D, state: RabbitState) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, "#79c2e6");
  g.addColorStop(1, "#d9f1f6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffe28a";
  ctx.beginPath();
  ctx.arc(760, 70, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 226, 138, 0.3)";
  ctx.beginPath();
  ctx.arc(760, 70, 50, 0, Math.PI * 2);
  ctx.fill();

  // Clouds drift slowly and a little with the meadow, wrapping around.
  const span = W + 300;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 5; i++) {
    const start = i * 200 + hash(i) * 120;
    const x = ((((start - state.distance * 0.12 - 8 * state.time) % span) + span) % span) - 140;
    const y = 30 + hash(i + 50) * 90;
    const s = 0.7 + hash(i + 90) * 0.55;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.arc(24, -10, 26, 0, Math.PI * 2);
    ctx.arc(52, 0, 20, 0, Math.PI * 2);
    ctx.rect(0, 0, 52, 20);
    ctx.fill();
    ctx.restore();
  }
}

function drawHills(
  ctx: CanvasRenderingContext2D,
  distance: number,
  parallax: number,
  base: number,
  amp1: number,
  amp2: number,
  f1: number,
  f2: number,
  color: string,
) {
  const off = distance * parallax;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += 10) {
    ctx.lineTo(x, base + Math.sin((x + off) / f1) * amp1 + Math.sin((x + off) / f2) * amp2);
  }
  ctx.lineTo(W, GROUND);
  ctx.closePath();
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, scroll: number) {
  const soil = ctx.createLinearGradient(0, GROUND, 0, H);
  soil.addColorStop(0, "#946038");
  soil.addColorStop(1, "#6b4227");
  ctx.fillStyle = soil;
  ctx.fillRect(0, GROUND, W, H - GROUND);

  // pebbles fixed to the world
  const step = 46;
  const first = Math.floor(scroll / step);
  ctx.fillStyle = "rgba(60, 36, 20, 0.35)";
  for (let k = first; k < first + W / step + 2; k++) {
    const x = k * step - scroll + hash(k) * 30;
    const y = GROUND + 26 + hash(k + 7) * (H - GROUND - 36);
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + hash(k + 3) * 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // grass band
  ctx.fillStyle = "#5aa34a";
  ctx.fillRect(0, GROUND - 2, W, 14);
  ctx.fillStyle = "#4a8c3c";
  ctx.fillRect(0, GROUND + 10, W, 3);

  // grass tufts and flowers
  const tuft = 58;
  const firstTuft = Math.floor(scroll / tuft);
  for (let k = firstTuft; k < firstTuft + W / tuft + 2; k++) {
    if (hash(k + 11) > 0.55) continue;
    const x = k * tuft - scroll + hash(k + 5) * 40;
    ctx.strokeStyle = "#3f7d33";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 5, GROUND);
    ctx.lineTo(x - 7, GROUND - 9);
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x, GROUND - 12);
    ctx.moveTo(x + 5, GROUND);
    ctx.lineTo(x + 7, GROUND - 9);
    ctx.stroke();
    if (hash(k + 21) < 0.3) {
      ctx.fillStyle = hash(k + 2) < 0.5 ? "#fff6c9" : "#f6a6c1";
      ctx.beginPath();
      ctx.arc(x, GROUND - 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f3c12b";
      ctx.beginPath();
      ctx.arc(x, GROUND - 14, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, fonts: Fonts) {
  const bob = Math.sin(tile.bob * 4) * 4;
  // A collected tile floats up, grows and fades away in a third of a second.
  const fade = tile.collected ? Math.min(1, tile.sinceCollected * 3) : 0;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - fade);
  ctx.translate(tile.x, tile.y + bob - fade * 30);
  ctx.scale(1 + fade * 0.4, 1 + fade * 0.4);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = tile.collected ? "#e8742b" : "#fffaf0";
  ctx.beginPath();
  ctx.roundRect(-19, -19, 38, 38, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tile.collected ? "#ffffff" : INK;
  ctx.font = `400 28px ${fonts.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tile.letter, 0, 2);
  ctx.restore();
}

function drawRabbit(ctx: CanvasRenderingContext2D, state: RabbitState) {
  const r = state.rabbit;

  // ground shadow, smaller the higher the rabbit is
  const height = Math.max(0, GROUND - r.y);
  const shadow = Math.max(0.35, 1 - height / 180);
  ctx.fillStyle = "rgba(30, 50, 25, 0.25)";
  ctx.beginPath();
  ctx.ellipse(r.x, GROUND + 3, 26 * shadow, 5 * shadow, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(r.x, r.y);

  // squash on landing, stretch while rising
  let sx = 1;
  let sy = 1;
  if (r.squash > 0) {
    sx = 1 + 0.18 * r.squash;
    sy = 1 - 0.18 * r.squash;
  } else if (!r.onGround && r.vy < 0) {
    sx = 0.93;
    sy = 1.08;
  }
  ctx.scale(sx, sy);

  const running = r.onGround;
  const cycle = running ? Math.sin(state.time * 20) : 0;
  const air = !r.onGround;
  const earTilt = air ? (r.vy < 0 ? 0.55 : -0.15) : 0.2 + cycle * 0.06;

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  const fur = "#f4efe6";
  const furShade = "#ddd3c4";
  const pink = "#f2a3b0";

  // back ear
  ctx.fillStyle = furShade;
  ellipse(ctx, 14, -64, 6, 20, -0.25 - earTilt);
  // hind leg
  const hindX = air ? -22 : -14 + cycle * 6;
  ellipse(ctx, hindX, -6 - (air ? 4 : Math.max(0, cycle) * 4), 15, 7, air ? 0.35 : 0);
  // tail
  ctx.fillStyle = "#ffffff";
  ellipse(ctx, -29, -30, 8, 8);
  // body
  ctx.fillStyle = fur;
  ellipse(ctx, -4, -25 - (running ? Math.abs(cycle) * 2 : 0), 27, 19, -0.08);
  // front leg
  const frontX = air ? 20 : 14 - cycle * 6;
  ellipse(ctx, frontX, -6 - (air ? 6 : Math.max(0, -cycle) * 4), 7, 5.5, air ? -0.5 : 0);
  // head
  ellipse(ctx, 21, -42, 16, 14);
  // front ear with its pink inside
  ellipse(ctx, 22, -66, 6.5, 21, 0.05 - earTilt);
  ctx.fillStyle = pink;
  ctx.beginPath();
  ctx.ellipse(22, -66, 3, 15, 0.05 - earTilt, 0, Math.PI * 2);
  ctx.fill();
  // eye, nose, cheek
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(27, -45, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(28, -46, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pink;
  ctx.beginPath();
  ctx.arc(36.5, -40, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(242, 163, 176, 0.55)";
  ctx.beginPath();
  ctx.arc(25, -36, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
