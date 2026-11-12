import { Engine } from './engine';
import { COLS, ROWS, HIDDEN, PIECE_INDEX } from './constants';
import type { PieceType } from './constants';

export interface BotSkill { aps: number; error: number; thinkMs: number }

export function skillFromRating(rating: number): BotSkill {
  const t = Math.max(0, Math.min(1, (rating - 700) / 1900));
  return { aps: 4.5 + t * 7.5, error: 0.24 - t * 0.21, thinkMs: 280 - t * 210 };
}

interface Plan { rot: number; x: number; pieceId: number }

export class Bot {
  private plan: Plan | null = null;
  private thinkT = 0;
  private acc = 0;

  constructor(public engine: Engine, public skill: BotSkill) {}

  update(dt: number) {
    const e = this.engine;
    if (e.status !== 'playing' || !e.active) return;
    if (!this.plan || this.plan.pieceId !== e.pieceId) {
      this.plan = null;
      this.thinkT += dt;
      if (this.thinkT >= this.skill.thinkMs / 1000) {
        this.thinkT = 0;
        this.plan = this.computePlan();
      }
      return;
    }
    this.acc += dt;
    const iv = 1 / this.skill.aps;
    let guard = 0;
    while (this.acc >= iv && guard++ < 8) {
      this.acc -= iv;
      this.step();
      if (!e.active || !this.plan || e.pieceId !== this.plan.pieceId) { this.plan = null; break; }
    }
  }

  private step() {
    const e = this.engine;
    const a = e.active!;
    const p = this.plan!;
    if (a.rot !== p.rot) {
      const diff = (p.rot - a.rot + 4) % 4;
      const ok = e.rotate(diff === 3 ? -1 : 1);
      if (!ok) e.hardDrop();
      return;
    }
    if (a.x < p.x) { if (!e.move(1)) e.hardDrop(); return; }
    if (a.x > p.x) { if (!e.move(-1)) e.hardDrop(); return; }
    e.hardDrop();
    this.plan = null;
  }

  private computePlan(): Plan {
    const e = this.engine;
    const a = e.active!;
    const type = a.type;
    const candidates: { rot: number; x: number; score: number }[] = [];

    for (let rot = 0; rot < 4; rot++) {
      if (type === 'O' && rot > 0) break;
      if ((type === 'I' || type === 'S' || type === 'Z') && rot >= 2) break;
      let reachable = false;
      for (let dx = -2; dx <= 2 && !reachable; dx++) {
        if (e.fits(type, rot, a.x + dx, a.y)) reachable = true;
      }
      if (!reachable) continue;

      for (let x = -2; x < COLS; x++) {
        if (!e.fits(type, rot, x, a.y)) continue;
        let y = a.y;
        while (e.fits(type, rot, x, y + 1)) y++;
        const cells = e.cellsOf(type, rot, x, y);
        if (cells.every(([, cy]) => cy < HIDDEN)) continue;

        const b = e.board.map((r) => r.slice());
        for (const [cx, cy] of cells) b[cy][cx] = PIECE_INDEX[type];
        let cleared = 0;
        for (let ry = 0; ry < ROWS; ry++) {
          if (b[ry].every((v) => v)) { b.splice(ry, 1); b.unshift(new Array(COLS).fill(0)); cleared++; ry--; }
        }

        const heights: number[] = [];
        let holes = 0;
        for (let cx = 0; cx < COLS; cx++) {
          let h = 0;
          let blocked = false;
          for (let ry = 0; ry < ROWS; ry++) {
            if (b[ry][cx]) { if (!blocked) { h = ROWS - ry; blocked = true; } }
            else if (blocked) holes++;
          }
          heights.push(h);
        }
        const agg = heights.reduce((s, h) => s + h, 0);
        let bump = 0;
        for (let cx = 0; cx < COLS - 1; cx++) bump += Math.abs(heights[cx] - heights[cx + 1]);
        const maxH = Math.max(...heights);

        let score = cleared * 0.76 - agg * 0.51 - holes * 0.36 - bump * 0.18;
        if (cleared === 4) score += 0.5;
        if (maxH > 13) score -= (maxH - 13) * 0.6;
        candidates.push({ rot, x, score });
      }
    }

    if (!candidates.length) return { rot: a.rot, x: a.x, pieceId: e.pieceId };
    candidates.sort((p, q) => q.score - p.score);
    let pick = candidates[0];
    if (Math.random() < this.skill.error && candidates.length > 2) {
      pick = candidates[1 + Math.floor(Math.random() * Math.min(4, candidates.length - 1))];
    }
    return { rot: pick.rot, x: pick.x, pieceId: e.pieceId };
  }
}

export function pieceLabel(t: PieceType): string { return t; }