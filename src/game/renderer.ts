import { COLS, ROWS, HIDDEN, VISIBLE, COLORS, SHAPES, BOX, currentTheme } from './constants';
import type { PieceType } from './constants';
import type { Active, GameEvent } from './engine';

export interface BoardView {
  board: number[][];
  active: Active | null;
  ghostY(): number;
  fever: boolean;
  heat: number;
  status: string;
  pendingTotal(): number;
  stackHeight(): number;
}

export interface RenderOpts {
  ghost: boolean;
  grid: boolean;
  shake: boolean;
  particles: 'low' | 'med' | 'high';
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
interface Popup { text: string; sub: string; t: number; color: string; big: boolean; dy: number }
interface Flash { rows: number[]; t: number }
interface Trail { cols: { x: number; from: number; to: number }[]; t: number; color: string }

const PARTICLE_COUNT = { low: 2, med: 4, high: 7 };

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private cell = 24;
  private ox = 0;
  private oy = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private sprites = new Map<string, HTMLCanvasElement>();
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private flashes: Flash[] = [];
  private trails: Trail[] = [];
  private shakeT = 0;
  private shakeMag = 0;
  private time = 0;
  private redFlash = 0;
  private goldFlash = 0;
  private ro: ResizeObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private view: () => BoardView,
    private opts: () => RenderOpts,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
  }

  destroy() { this.ro.disconnect(); }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.cell = Math.min(this.w / COLS, this.h / VISIBLE);
    this.ox = (this.w - this.cell * COLS) / 2;
    this.oy = (this.h - this.cell * VISIBLE) / 2;
    this.sprites.clear();
  }

  private sprite(v: number): HTMLCanvasElement {
    const key = `${currentTheme.id}:${v}:${this.cell.toFixed(2)}`;
    let s = this.sprites.get(key);
    if (s) return s;
    const c = this.cell;
    const pad = Math.ceil(c * 0.3);
    s = document.createElement('canvas');
    s.width = Math.ceil((c + pad * 2) * this.dpr);
    s.height = Math.ceil((c + pad * 2) * this.dpr);
    const g = s.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    const color = COLORS[v] || '#888';
    const r = c * 0.16;
    const x = pad, y = pad;
    if (v !== 8) {
      g.shadowColor = color;
      g.shadowBlur = c * 0.28;
    }
    const grad = g.createLinearGradient(x, y, x, y + c);
    grad.addColorStop(0, lighten(color, v === 8 ? 0.12 : 0.35));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, darken(color, v === 8 ? 0.25 : 0.3));
    g.fillStyle = grad;
    roundRect(g, x + 0.5, y + 0.5, c - 1, c - 1, r);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 1;
    roundRect(g, x + 0.5, y + 0.5, c - 1, c - 1, r);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(g, x + c * 0.14, y + c * 0.1, c * 0.72, c * 0.16, r * 0.6);
    g.fill();
    if (v === 8) {
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.moveTo(x + c * 0.2, y + c * 0.55);
      g.lineTo(x + c * 0.5, y + c * 0.4);
      g.lineTo(x + c * 0.8, y + c * 0.65);
      g.stroke();
    }
    this.sprites.set(key, s);
    return s;
  }

  private drawCell(v: number, px: number, py: number, glow = false) {
    const s = this.sprite(v);
    const pad = Math.ceil(this.cell * 0.3);
    const size = this.cell + pad * 2;
    if (glow) {
      this.ctx.save();
      this.ctx.shadowColor = COLORS[v];
      this.ctx.shadowBlur = this.cell * 0.55;
      this.ctx.drawImage(s, px - pad, py - pad, size, size);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(s, px - pad, py - pad, size, size);
    }
  }

  private cellPos(x: number, y: number): [number, number] {
    return [this.ox + x * this.cell, this.oy + (y - HIDDEN) * this.cell];
  }

  onEvent(e: GameEvent) {
    const o = this.opts();
    const pc = PARTICLE_COUNT[o.particles];
    const v = this.view();
    switch (e.t) {
      case 'clear': {
        this.flashes.push({ rows: e.rows!, t: 0 });
        for (const c of e.cells!) {
          if (c.y < HIDDEN) continue;
          const [px, py] = this.cellPos(c.x, c.y);
          for (let i = 0; i < pc; i++) {
            this.particles.push({
              x: px + this.cell / 2, y: py + this.cell / 2,
              vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 300 - 40,
              life: 0.7 + Math.random() * 0.5, max: 1.2,
              size: this.cell * (0.08 + Math.random() * 0.14),
              color: COLORS[c.v],
            });
          }
        }
        const big = e.kind === 'tetris' || (e.kind || '').startsWith('ts');
        this.addPopup(e.text || '', this.clearSub(e), big ? currentTheme.gold : currentTheme.primary, big);
        if (o.shake) this.shake(e.n! >= 4 ? 9 : 3.5 + e.n!);
        if (e.kind === 'tetris') this.goldFlash = 0.35;
        break;
      }
      case 'hard': {
        const a = v.active;
        if (a && e.distance) {
          const cols = new Map<number, { from: number; to: number }>();
          for (const [cx, cy] of SHAPES[a.type][a.rot]) {
            const x = a.x + cx;
            const cur = cols.get(x);
            const from = (e.fromY ?? a.y) + cy;
            const to = a.y + (e.distance ?? 0) + cy;
            if (!cur) cols.set(x, { from, to });
            else { cur.from = Math.min(cur.from, from); cur.to = Math.max(cur.to, to); }
          }
          this.trails.push({
            cols: [...cols.entries()].map(([x, r]) => ({ x, from: r.from, to: r.to })),
            t: 0, color: COLORS[{ I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }[a.type]],
          });
        }
        if (o.shake && (e.distance ?? 0) > 3) this.shake(2.5);
        break;
      }
      case 'garbage': {
        if (e.applied) {
          this.redFlash = 0.4;
          if (o.shake) this.shake(6);
        } else if (o.shake) this.shake(2);
        break;
      }
      case 'fever': {
        this.addPopup('FEVER!!', '得分 ×2 · 攻击 +2', currentTheme.gold, true);
        this.goldFlash = 0.6;
        if (o.shake) this.shake(10);
        for (let i = 0; i < pc * 10; i++) {
          this.particles.push({
            x: this.ox + Math.random() * this.cell * COLS,
            y: this.oy + this.cell * VISIBLE,
            vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 420 - 120,
            life: 1 + Math.random(), max: 2,
            size: this.cell * (0.1 + Math.random() * 0.16),
            color: [currentTheme.gold, currentTheme.hot, currentTheme.primary][i % 3],
          });
        }
        break;
      }
      case 'pc': {
        this.addPopup('PERFECT CLEAR', '全场清空 +10 攻击', COLORS[1], true);
        for (let i = 0; i < pc * 12; i++) {
          this.particles.push({
            x: this.ox + Math.random() * this.cell * COLS,
            y: this.oy + Math.random() * this.cell * VISIBLE,
            vx: (Math.random() - 0.5) * 320, vy: (Math.random() - 0.5) * 320,
            life: 0.9 + Math.random() * 0.6, max: 1.5,
            size: this.cell * (0.08 + Math.random() * 0.12),
            color: Object.values(COLORS)[i % 7],
          });
        }
        break;
      }
      case 'levelup': {
        this.addPopup(`LEVEL ${e.n}`, '重力提升', COLORS[4], false);
        break;
      }
      case 'over': {
        this.redFlash = 0.7;
        if (o.shake) this.shake(12);
        break;
      }
      case 'attack': {
        this.addPopup(`ATTACK +${e.n}`, '', COLORS[5], false);
        break;
      }
    }
  }

  private addPopup(text: string, sub: string, color: string, big: boolean) {
    // 同帧多个弹窗（消行+全消+狂热+升级）按槽位错开，避免文字重叠
    const dy = this.popups.filter((p) => p.t < 0.9).length * 46;
    this.popups.push({ text, sub, t: 0, color, big, dy });
  }

  private clearSub(e: GameEvent): string {
    const parts: string[] = [];
    if (e.b2b) parts.push('B2B');
    if ((e.combo ?? 0) > 0) parts.push(`COMBO ×${e.combo}`);
    if (e.points) parts.push(`+${e.points}`);
    return parts.join(' · ');
  }

  private shake(mag: number) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = 0.3;
  }

  draw(dt: number) {
    this.time += dt;
    const ctx = this.ctx;
    const v = this.view();
    const o = this.opts();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // shake
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / 0.3) * this.shakeMag;
      sx = (Math.random() - 0.5) * k;
      sy = (Math.random() - 0.5) * k;
      if (this.shakeT <= 0) this.shakeMag = 0;
    }
    ctx.save();
    ctx.translate(sx, sy);

    const bw = this.cell * COLS, bh = this.cell * VISIBLE;

    // board background
    const bg = ctx.createLinearGradient(0, this.oy, 0, this.oy + bh);
    bg.addColorStop(0, hexA(currentTheme.boardTop, 0.92));
    bg.addColorStop(1, hexA(currentTheme.boardBottom, 0.96));
    ctx.fillStyle = bg;
    ctx.fillRect(this.ox, this.oy, bw, bh);

    // grid
    if (o.grid) {
      ctx.strokeStyle = hexA(currentTheme.primary, 0.07);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < COLS; x++) {
        ctx.moveTo(this.ox + x * this.cell, this.oy);
        ctx.lineTo(this.ox + x * this.cell, this.oy + bh);
      }
      for (let y = 1; y < VISIBLE; y++) {
        ctx.moveTo(this.ox, this.oy + y * this.cell);
        ctx.lineTo(this.ox + bw, this.oy + y * this.cell);
      }
      ctx.stroke();
    }

    // danger vignette
    const sh = v.stackHeight();
    if (sh > 13 && v.status === 'playing') {
      const a = Math.min(0.4, (sh - 13) * 0.06) * (0.7 + 0.3 * Math.sin(this.time * 6));
      const dg = ctx.createLinearGradient(0, this.oy, 0, this.oy + bh * 0.4);
      dg.addColorStop(0, `rgba(255,40,40,${a})`);
      dg.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = dg;
      ctx.fillRect(this.ox, this.oy, bw, bh * 0.4);
    }

    // heat aura
    if (!v.fever && v.heat > 55) {
      const a = ((v.heat - 55) / 45) * 0.16;
      const hg = ctx.createLinearGradient(0, this.oy + bh, 0, this.oy + bh * 0.5);
      hg.addColorStop(0, hexA(currentTheme.hot, a));
      hg.addColorStop(1, hexA(currentTheme.hot, 0));
      ctx.fillStyle = hg;
      ctx.fillRect(this.ox, this.oy, bw, bh);
    }

    // clip to board for cells
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.ox - 1, this.oy - 1, bw + 2, bh + 2);
    ctx.clip();

    // stack
    for (let y = HIDDEN; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const val = v.board[y][x];
        if (!val) continue;
        const [px, py] = this.cellPos(x, y);
        this.drawCell(val, px, py);
      }
    }

    // hard drop trails
    for (const tr of this.trails) {
      tr.t += dt;
      const a = Math.max(0, 1 - tr.t / 0.2);
      for (const c of tr.cols) {
        const [px] = this.cellPos(c.x, 0);
        const fy = this.oy + (c.from - HIDDEN) * this.cell;
        const ty = this.oy + (c.to - HIDDEN) * this.cell;
        const g = ctx.createLinearGradient(0, fy, 0, ty);
        g.addColorStop(0, hexA(tr.color, 0));
        g.addColorStop(1, hexA(tr.color, 0.3 * a));
        ctx.fillStyle = g;
        ctx.fillRect(px + this.cell * 0.15, fy, this.cell * 0.7, Math.max(0, ty - fy));
      }
    }
    this.trails = this.trails.filter((t) => t.t < 0.2);

    // ghost
    const a = v.active;
    if (a && o.ghost && v.status === 'playing') {
      const gy = v.ghostY();
      if (gy !== a.y) {
        const color = COLORS[{ I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }[a.type]];
        for (const [cx, cy] of SHAPES[a.type][a.rot]) {
          const y = gy + cy;
          if (y < HIDDEN) continue;
          const [px, py] = this.cellPos(a.x + cx, y);
          ctx.fillStyle = hexA(color, 0.09);
          roundRect(ctx, px + 1, py + 1, this.cell - 2, this.cell - 2, this.cell * 0.16);
          ctx.fill();
          ctx.strokeStyle = hexA(color, 0.4);
          ctx.lineWidth = 1.5;
          roundRect(ctx, px + 1.5, py + 1.5, this.cell - 3, this.cell - 3, this.cell * 0.16);
          ctx.stroke();
        }
      }
      // active piece
      for (const [cx, cy] of SHAPES[a.type][a.rot]) {
        const y = a.y + cy;
        if (y < HIDDEN) continue;
        const [px, py] = this.cellPos(a.x + cx, y);
        this.drawCell({ I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }[a.type], px, py, true);
      }
    }

    // line clear flashes
    for (const f of this.flashes) {
      f.t += dt;
      const k = Math.max(0, 1 - f.t / 0.24);
      ctx.fillStyle = `rgba(255,240,220,${0.75 * k})`;
      for (const y of f.rows) {
        if (y < HIDDEN) continue;
        const py = this.oy + (y - HIDDEN) * this.cell;
        const grow = (1 - k) * this.cell * 0.5;
        ctx.fillRect(this.ox - grow, py + grow * 0.4, bw + grow * 2, this.cell - grow * 0.8);
      }
    }
    this.flashes = this.flashes.filter((f) => f.t < 0.24);

    // fever embers + tint
    if (v.fever) {
      const rate = o.particles === 'low' ? 0.4 : o.particles === 'med' ? 0.9 : 1.6;
      if (Math.random() < rate) {
        this.particles.push({
          x: this.ox + Math.random() * bw, y: this.oy + bh,
          vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 160 - 60,
          life: 0.8 + Math.random() * 0.7, max: 1.5,
          size: this.cell * (0.06 + Math.random() * 0.1),
          color: Math.random() < 0.5 ? currentTheme.gold : currentTheme.hot,
        });
      }
      ctx.fillStyle = hexA(currentTheme.hot, 0.05 + 0.02 * Math.sin(this.time * 8));
      ctx.fillRect(this.ox, this.oy, bw, bh);
    }

    // particles
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.vx *= 1 - 0.9 * dt;
      const k = Math.max(0, p.life / p.max);
      ctx.fillStyle = hexA(p.color, k * 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);

    ctx.restore(); // clip

    // fever border
    if (v.fever) {
      const hue = currentTheme.hue + 20 * Math.sin(this.time * 5);
      ctx.strokeStyle = `hsla(${hue},100%,60%,0.9)`;
      ctx.lineWidth = 3;
      ctx.shadowColor = currentTheme.hot;
      ctx.shadowBlur = 14;
      ctx.strokeRect(this.ox - 1.5, this.oy - 1.5, bw + 3, bh + 3);
      ctx.shadowBlur = 0;
    }

    // flashes overlay
    if (this.redFlash > 0) {
      this.redFlash -= dt;
      ctx.fillStyle = `rgba(255,40,30,${Math.max(0, this.redFlash) * 0.3})`;
      ctx.fillRect(this.ox, this.oy, bw, bh);
    }
    if (this.goldFlash > 0) {
      this.goldFlash -= dt;
      ctx.fillStyle = hexA(currentTheme.gold, Math.max(0, this.goldFlash) * 0.25);
      ctx.fillRect(this.ox, this.oy, bw, bh);
    }

    // popups
    for (const p of this.popups) {
      p.t += dt;
      const k = p.t < 0.15 ? p.t / 0.15 : Math.max(0, 1 - (p.t - 0.15) / 1.0);
      const y = this.oy + bh * 0.32 - p.t * 34 + p.dy;
      const size = Math.max(15, Math.min(30, this.cell * (p.big ? 1.15 : 0.85)));
      ctx.save();
      ctx.globalAlpha = k;
      ctx.textAlign = 'center';
      ctx.font = `900 ${size}px Orbitron, 'Segoe UI', sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(10,5,3,0.85)';
      ctx.strokeText(p.text, this.ox + bw / 2, y);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillText(p.text, this.ox + bw / 2, y);
      ctx.shadowBlur = 0;
      if (p.sub) {
        ctx.font = `700 ${size * 0.52}px Rajdhani, 'Microsoft YaHei', sans-serif`;
        ctx.strokeText(p.sub, this.ox + bw / 2, y + size * 0.72);
        ctx.fillStyle = '#f5ece4';
        ctx.fillText(p.sub, this.ox + bw / 2, y + size * 0.72);
      }
      ctx.restore();
    }
    this.popups = this.popups.filter((p) => p.t < 1.2);

    ctx.restore(); // shake
  }
}

export function drawMini(canvas: HTMLCanvasElement, type: PieceType | null, dim = false) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 4) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(rect.width * dpr)) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (!type) return;
  const cells = SHAPES[type][0];
  const n = BOX[type];
  const cell = Math.min(rect.width / (n + 0.6), rect.height / (n + 0.6));
  const minX = Math.min(...cells.map((c) => c[0]));
  const maxX = Math.max(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const pw = (maxX - minX + 1) * cell, ph = (maxY - minY + 1) * cell;
  const ox = (rect.width - pw) / 2 - minX * cell;
  const oy = (rect.height - ph) / 2 - minY * cell;
  const color = COLORS[{ I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }[type]];
  ctx.globalAlpha = dim ? 0.35 : 1;
  for (const [cx, cy] of cells) {
    const x = ox + cx * cell, y = oy + cy * cell;
    const g = ctx.createLinearGradient(x, y, x, y + cell);
    g.addColorStop(0, lighten(color, 0.3));
    g.addColorStop(1, darken(color, 0.25));
    ctx.fillStyle = g;
    if (!dim) { ctx.shadowColor = color; ctx.shadowBlur = cell * 0.3; }
    roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, cell * 0.18);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, x + cell * 0.16, y + cell * 0.12, cell * 0.68, cell * 0.16, cell * 0.08);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

function lighten(hex: string, k: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r + (255 - r) * k)},${Math.round(g + (255 - g) * k)},${Math.round(b + (255 - b) * k)})`;
}

function darken(hex: string, k: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - k))},${Math.round(g * (1 - k))},${Math.round(b * (1 - k))})`;
}