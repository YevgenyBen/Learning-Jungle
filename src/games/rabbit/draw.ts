/**
 * Draws the rabbit Game's meadow from the model's state, in the model's
 * logical coordinates (WORLD). Shapes and colours are ported from the
 * single-page prototype (see docs/prototype-parity.md). Drawing only:
 * nothing here changes the state.
 */
import { WORLD, type CelebratedWord, type Landing, type RabbitState, type Tile } from "./model";

const { width: W, height: H, ground: GROUND } = WORLD;

/** How long the Challenge Celebration's sign and the rabbit's happy dance last. */
export const SIGN_SECONDS = 1.8;

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
  // The Hint highlights the needed letter's tiles.
  const hinted = state.hint ? state.challenge.letters[state.challenge.next]?.letter : undefined;
  for (const tile of state.tiles) drawTile(ctx, tile, fonts, tile.letter === hinted, state.time);
  for (const landing of state.landings) drawLandingDust(ctx, landing, state.speed);
  if (state.celebrated) drawParty(ctx, state.celebrated);
  drawRabbit(ctx, state);
}

/**
 * The little puff of dust where the rabbit lands (the prototype's puff()):
 * six specks kicked up behind its feet that drift back with the meadow and fade.
 */
function drawLandingDust(ctx: CanvasRenderingContext2D, landing: Landing, speed: number) {
  const t = landing.since;
  const rand = seeded(landing.id + 0x5eed);
  ctx.fillStyle = "#d2bea0";
  for (let i = 0; i < 6; i++) {
    const vx = rand(-90, 40);
    const vy = rand(-80, -20);
    const life = rand(0.3, 0.5);
    const r = rand(3, 6);
    if (t >= life) continue;
    ctx.globalAlpha = Math.min(1, (life - t) * 1.6);
    ctx.beginPath();
    ctx.arc(WORLD.rabbitX - 10 + (vx - speed * 0.3) * t, GROUND + vy * t, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

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

/**
 * The Challenge Celebration's star burst from the rabbit and confetti over
 * the whole meadow (the prototype's party()). Each particle flies on its
 * own arc, worked out from the time since the Word was completed.
 */
function drawParty(ctx: CanvasRenderingContext2D, celebrated: CelebratedWord) {
  const t = celebrated.since;
  const rand = seeded(celebrated.number);
  const particle = (
    x: number,
    y: number,
    vx: number,
    vy: number,
    g: number,
    life: number,
    r: number,
    rot: number,
    spin: number,
    color: string,
    star: boolean,
  ) => {
    if (t >= life) return;
    const px = x + vx * t;
    const py = y + vy * t + (g * t * t) / 2;
    ctx.globalAlpha = Math.min(1, (life - t) * 1.6);
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot + spin * t);
    if (star) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-r, -r / 2, r * 2, r);
    }
    ctx.restore();
  };

  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(150, 280);
    const life = rand(0.9, 1.3);
    const r = rand(7, 11);
    const rot = rand(0, 6);
    const spin = rand(-6, 6);
    const color = i % 2 ? "#f3c12b" : "#e8742b";
    particle(WORLD.rabbitX, celebrated.rabbitY - 40, Math.cos(a) * v, Math.sin(a) * v - 140, 320, life, r, rot, spin, color, true);
  }
  for (let i = 0; i < 80; i++) {
    const x = rand(0, W);
    const y = rand(-140, -10);
    const vx = rand(-30, 30);
    const vy = rand(60, 160);
    const life = rand(1.8, 2.6);
    const r = rand(3, 5);
    const rot = rand(0, 6);
    const spin = rand(-8, 8);
    particle(x, y, vx, vy, 120, life, r, rot, spin, CONFETTI[i % CONFETTI.length], false);
  }
  ctx.globalAlpha = 1;
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

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, fonts: Fonts, hinted: boolean, time: number) {
  const bob = Math.sin(tile.bob * 4) * 4;
  // A collected tile floats up, grows and fades away in a third of a second.
  const fade = tile.collected ? Math.min(1, tile.sinceCollected * 3) : 0;
  // A wrong letter gives a small, soft shake and turns quiet; it stays where it is.
  const shake = tile.rejected ? Math.sin(tile.sinceRejected * 40) * 4 * Math.max(0, 1 - tile.sinceRejected / 0.4) : 0;
  const quiet = tile.rejected && !tile.collected;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - fade);
  ctx.translate(tile.x + shake, tile.y + bob - fade * 30);
  ctx.scale(1 + fade * 0.4, 1 + fade * 0.4);
  if (hinted && !tile.collected) {
    // The Hint: a warm, pulsing glow around the needed letter.
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    ctx.fillStyle = `rgba(245, 197, 66, ${0.45 + 0.35 * pulse})`;
    ctx.beginPath();
    ctx.roundRect(-27 - pulse * 3, -27 - pulse * 3, 54 + pulse * 6, 54 + pulse * 6, 14);
    ctx.fill();
  }
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = quiet ? "#8a948e" : INK;
  ctx.fillStyle = tile.collected ? "#e8742b" : hinted ? "#fff1b8" : quiet ? "#ece8df" : "#fffaf0";
  ctx.beginPath();
  ctx.roundRect(-19, -19, 38, 38, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tile.collected ? "#ffffff" : quiet ? "#8a948e" : INK;
  ctx.font = `400 28px ${fonts.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tile.marked, 0, 2);
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

  // The happy dance after a Word: a backflip, then a few bounces that settle.
  // Drawing only: where the rabbit really is (for collecting) doesn't change.
  const dance = state.celebrated && state.celebrated.since < SIGN_SECONDS ? state.celebrated.since : null;
  if (dance !== null) {
    ctx.translate(0, -Math.abs(Math.sin(dance * 9)) * 14 * Math.max(0, 1 - dance / 1.4));
    if (dance < 0.5) {
      ctx.translate(0, -35);
      ctx.rotate(-easeOut(dance / 0.5) * Math.PI * 2);
      ctx.translate(0, 35);
    }
  }

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
  // eye (a happy "^" and a smile while dancing), nose, cheek
  if (dance !== null) {
    ctx.beginPath();
    ctx.arc(27, -43, 3.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, -37, 3.5, 0.3, Math.PI - 0.3);
    ctx.stroke();
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(27, -45, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(28, -46, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
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
