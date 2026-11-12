import {
  COLS, ROWS, HIDDEN, PIECES, PIECE_INDEX, GARBAGE, SHAPES, SPAWN_X, SPAWN_Y,
  KICKS_I, KICKS_JLSTZ, LOCK_DELAY, MAX_LOCK_RESETS, gravityInterval,
  CLEAR_SCORE, CLEAR_ATTACK, CLEAR_LABEL, COMBO_ATTACK, PC_SCORE,
  FEVER_DURATION, FEVER_MAX, SPRINT_TARGET,
} from './constants';
import type { PieceType, ClearKind, Mode } from './constants';
import { rngFromSeed } from './rng';

export interface Active { type: PieceType; rot: number; x: number; y: number }
export type Status = 'ready' | 'playing' | 'over' | 'win';

export interface GameEvent {
  t: 'move' | 'rotate' | 'hard' | 'lock' | 'hold' | 'spawn' | 'clear' | 'attack'
  | 'garbage' | 'fever' | 'feverEnd' | 'over' | 'win' | 'levelup' | 'pc';
  rows?: number[];
  cells?: { x: number; y: number; v: number }[];
  kind?: ClearKind;
  n?: number;
  col?: number;
  points?: number;
  combo?: number;
  b2b?: boolean;
  text?: string;
  distance?: number;
  fromY?: number;
  type?: PieceType;
  applied?: boolean;
}

export interface EngineOpts {
  seed: string | number;
  mode: Mode;
  startLevel?: number;
  versus?: boolean;
  onEvent?: (e: GameEvent) => void;
}

export class Engine {
  board: number[][] = [];
  active: Active | null = null;
  hold: PieceType | null = null;
  holdUsed = false;
  queue: PieceType[] = [];
  private bag: PieceType[] = [];
  private rand: () => number;

  score = 0;
  lines = 0;
  level = 1;
  startLevel = 1;
  combo = -1;
  b2b = false;
  heat = 0;
  fever = false;
  feverT = 0;
  pending: { n: number; col: number }[] = [];
  status: Status = 'ready';

  elapsed = 0;
  pieces = 0;
  attackTotal = 0;
  maxCombo = 0;
  tspins = 0;
  tetrises = 0;
  pcs = 0;
  pieceId = 0;

  soft = false;
  private fallAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lowestY = 0;
  private lastRotate = false;
  private lastKick = 0;

  mode: Mode;
  versus: boolean;
  private emit: (e: GameEvent) => void;

  constructor(opts: EngineOpts) {
    this.rand = rngFromSeed(opts.seed);
    this.mode = opts.mode;
    this.versus = !!opts.versus;
    this.startLevel = opts.startLevel ?? 1;
    this.level = this.startLevel;
    this.emit = opts.onEvent ?? (() => {});
    for (let y = 0; y < ROWS; y++) this.board.push(new Array(COLS).fill(0));
    this.refill();
  }

  start() {
    if (this.status !== 'ready') return;
    this.status = 'playing';
    this.spawnNext();
  }

  private onEvent(e: GameEvent) { this.emit(e); }

  cellsOf(type: PieceType, rot: number, x: number, y: number): [number, number][] {
    return SHAPES[type][rot].map(([cx, cy]) => [x + cx, y + cy] as [number, number]);
  }

  fits(type: PieceType, rot: number, x: number, y: number): boolean {
    for (const [cx, cy] of this.cellsOf(type, rot, x, y)) {
      if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return false;
      if (this.board[cy][cx]) return false;
    }
    return true;
  }

  private canDown(): boolean {
    const a = this.active;
    return !!a && this.fits(a.type, a.rot, a.x, a.y + 1);
  }

  ghostY(): number {
    const a = this.active;
    if (!a) return 0;
    let y = a.y;
    while (this.fits(a.type, a.rot, a.x, y + 1)) y++;
    return y;
  }

  pendingTotal(): number {
    return this.pending.reduce((s, p) => s + p.n, 0);
  }

  stackHeight(): number {
    for (let y = 0; y < ROWS; y++) {
      if (this.board[y].some((v) => v)) return ROWS - y;
    }
    return 0;
  }

  move(dx: number): boolean {
    if (this.status !== 'playing' || !this.active) return false;
    const a = this.active;
    if (!this.fits(a.type, a.rot, a.x + dx, a.y)) return false;
    a.x += dx;
    this.lastRotate = false;
    this.groundReset();
    this.onEvent({ t: 'move' });
    return true;
  }

  rotate(dir: 1 | -1): boolean {
    if (this.status !== 'playing' || !this.active) return false;
    const a = this.active;
    if (a.type === 'O') return false;
    const to = (a.rot + dir + 4) % 4;
    const table = a.type === 'I' ? KICKS_I : KICKS_JLSTZ;
    const kicks = table[`${a.rot}${to}`];
    for (let i = 0; i < kicks.length; i++) {
      const [dx, dy] = kicks[i];
      if (this.fits(a.type, to, a.x + dx, a.y + dy)) {
        a.rot = to; a.x += dx; a.y += dy;
        this.lastRotate = true;
        this.lastKick = i;
        if (a.y > this.lowestY) { this.lowestY = a.y; this.lockResets = 0; }
        this.groundReset();
        this.onEvent({ t: 'rotate' });
        return true;
      }
    }
    return false;
  }

  private groundReset() {
    if (!this.canDown() && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }

  setSoft(b: boolean) { this.soft = b; }

  hardDrop() {
    if (this.status !== 'playing' || !this.active) return;
    const a = this.active;
    const gy = this.ghostY();
    const d = gy - a.y;
    if (d > 0) this.addScore(d * 2);
    this.onEvent({ t: 'hard', distance: d, fromY: a.y });
    a.y = gy;
    this.lock();
  }

  holdSwap() {
    if (this.status !== 'playing' || !this.active || this.holdUsed) return;
    const cur = this.active.type;
    this.onEvent({ t: 'hold' });
    if (this.hold) {
      const h = this.hold;
      this.hold = cur;
      this.spawnType(h);
    } else {
      this.hold = cur;
      this.spawnNext();
    }
    this.holdUsed = true;
  }

  update(dt: number) {
    if (this.status !== 'playing') return;
    this.elapsed += dt;

    if (this.fever) {
      this.feverT -= dt;
      this.heat = Math.max(0, (this.feverT / FEVER_DURATION) * FEVER_MAX);
      if (this.feverT <= 0) {
        this.fever = false;
        this.heat = 0;
        this.onEvent({ t: 'feverEnd' });
      }
    } else {
      this.heat = Math.max(0, this.heat - 2.5 * dt);
    }

    const a = this.active;
    if (!a) return;
    const g = gravityInterval(this.level);
    const interval = this.soft ? Math.max(0.01, g / 20) : g;

    if (this.canDown()) {
      this.lockTimer = 0;
      this.fallAcc += dt;
      while (this.fallAcc >= interval && this.canDown()) {
        this.fallAcc -= interval;
        a.y++;
        this.lastRotate = false;
        if (a.y > this.lowestY) {
          this.lowestY = a.y;
          this.lockResets = 0;
          this.lockTimer = 0;
        }
      }
    } else {
      this.fallAcc = 0;
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) this.lock();
    }
  }

  private addScore(n: number) {
    this.score += this.fever ? n * 2 : n;
  }

  private lock() {
    const a = this.active;
    if (!a) return;
    const cells = this.cellsOf(a.type, a.rot, a.x, a.y);
    const v = PIECE_INDEX[a.type];
    for (const [x, y] of cells) this.board[y][x] = v;
    this.onEvent({ t: 'lock', cells: cells.map(([x, y]) => ({ x, y, v })) });
    this.pieces++;
    this.active = null;

    if (cells.every(([, y]) => y < HIDDEN)) { this.topOut(); return; }

    // T-Spin detection (3-corner rule)
    let tspin: 'none' | 'full' | 'mini' = 'none';
    if (a.type === 'T' && this.lastRotate) {
      const cx = a.x + 1, cy = a.y + 1;
      const occ = (x: number, y: number) =>
        x < 0 || x >= COLS || y < 0 || y >= ROWS || !!this.board[y][x];
      const corners = [occ(cx - 1, cy - 1), occ(cx + 1, cy - 1), occ(cx - 1, cy + 1), occ(cx + 1, cy + 1)];
      const filled = corners.filter(Boolean).length;
      if (filled >= 3) {
        const front: [boolean, boolean] =
          a.rot === 0 ? [corners[0], corners[1]] :
          a.rot === 1 ? [corners[1], corners[3]] :
          a.rot === 2 ? [corners[2], corners[3]] : [corners[0], corners[2]];
        tspin = (front[0] && front[1]) || this.lastKick === 4 ? 'full' : 'mini';
      }
    }

    const rows: number[] = [];
    for (let y = 0; y < ROWS; y++) {
      if (this.board[y].every((c) => c)) rows.push(y);
    }
    const n = rows.length;

    if (n > 0) {
      const snapshot: { x: number; y: number; v: number }[] = [];
      for (const y of rows) for (let x = 0; x < COLS; x++) snapshot.push({ x, y, v: this.board[y][x] });

      let kind: ClearKind;
      if (tspin === 'full') kind = (['ts0', 'ts1', 'ts2', 'ts3'] as ClearKind[])[Math.min(n, 3)];
      else if (tspin === 'mini') kind = (['mts0', 'mts1', 'mts2'] as ClearKind[])[Math.min(n, 2)];
      else kind = (['single', 'double', 'triple', 'tetris'] as ClearKind[])[Math.min(n, 4) - 1];

      const difficult = kind === 'tetris' || ((kind.startsWith('ts') || kind.startsWith('mts')) && n > 0);
      const b2bBonus = difficult && this.b2b;
      let points = CLEAR_SCORE[kind] * this.level;
      if (b2bBonus) points = Math.floor(points * 1.5);

      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const comboBonus = this.combo > 0 ? 50 * this.combo * this.level : 0;

      let attack = CLEAR_ATTACK[kind] + (b2bBonus ? 1 : 0)
        + COMBO_ATTACK[Math.min(this.combo, COMBO_ATTACK.length - 1)]
        + (this.fever ? 2 : 0);

      // remove rows
      for (const y of rows) { this.board.splice(y, 1); this.board.unshift(new Array(COLS).fill(0)); }
      this.lines += n;

      const perfect = this.board.every((row) => row.every((c) => !c));
      if (perfect) {
        points += PC_SCORE[Math.min(n, 4)] * this.level;
        attack += 10;
        this.pcs++;
        this.onEvent({ t: 'pc', n });
      }

      this.addScore(points + comboBonus);
      if (kind === 'tetris') this.tetrises++;
      if (tspin !== 'none') this.tspins++;
      if (difficult) this.b2b = true; else this.b2b = false;

      if (!this.fever) {
        this.heat = Math.min(FEVER_MAX, this.heat + n * 10 + (tspin !== 'none' ? 15 : 0) + (kind === 'tetris' ? 10 : 0) + Math.max(0, this.combo) * 3);
        if (this.heat >= FEVER_MAX) {
          this.fever = true;
          this.feverT = FEVER_DURATION;
          this.onEvent({ t: 'fever' });
        }
      }

      const newLevel = Math.min(20, this.startLevel + Math.floor(this.lines / 10));
      if (newLevel > this.level) {
        this.level = newLevel;
        this.onEvent({ t: 'levelup', n: newLevel });
      }

      this.onEvent({
        t: 'clear', rows, cells: snapshot, kind, n, points: points + comboBonus,
        combo: this.combo, b2b: b2bBonus, text: CLEAR_LABEL[kind],
      });

      if (attack > 0 && this.versus) this.sendAttack(attack);

      if (this.mode === 'sprint' && this.lines >= SPRINT_TARGET) {
        this.status = 'win';
        this.onEvent({ t: 'win' });
        return;
      }
    } else {
      this.combo = -1;
      if (this.pending.length) this.applyPending();
      if (this.status !== 'playing') return;
    }

    this.holdUsed = false;
    this.spawnNext();
  }

  private sendAttack(n: number) {
    let left = n;
    while (left > 0 && this.pending.length) {
      const p = this.pending[0];
      if (p.n <= left) { left -= p.n; this.pending.shift(); }
      else { p.n -= left; left = 0; }
    }
    if (left > 0) {
      this.attackTotal += left;
      this.onEvent({ t: 'attack', n: left });
    }
  }

  receiveAttack(n: number) {
    if (this.status !== 'playing' || n <= 0) return;
    const col = Math.floor(this.rand() * COLS);
    this.pending.push({ n, col });
    this.onEvent({ t: 'garbage', n, col });
  }

  private applyPending() {
    const total = this.pendingTotal();
    if (!total) return;
    if (total >= ROWS) { this.pending = []; this.topOut(); return; }
    for (let y = 0; y < total && y < ROWS; y++) {
      if (this.board[y].some((v) => v)) { this.pending = []; this.topOut(); return; }
    }
    for (let y = 0; y < ROWS - total; y++) this.board[y] = this.board[y + total];
    let i = 0;
    for (const p of this.pending) {
      for (let k = 0; k < p.n; k++) {
        const row = new Array(COLS).fill(GARBAGE);
        row[p.col] = 0;
        this.board[ROWS - total + i] = row;
        i++;
      }
    }
    this.pending = [];
    this.onEvent({ t: 'garbage', n: total, applied: true });
  }

  private refill() {
    while (this.queue.length < 7) {
      if (!this.bag.length) {
        this.bag = [...PIECES];
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.rand() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      this.queue.push(this.bag.pop()!);
    }
  }

  private spawnNext() {
    const type = this.queue.shift()!;
    this.refill();
    this.spawnType(type);
  }

  private spawnType(type: PieceType) {
    this.pieceId++;
    this.active = { type, rot: 0, x: SPAWN_X[type], y: SPAWN_Y };
    this.lastRotate = false;
    this.lastKick = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = SPAWN_Y;
    this.fallAcc = 0;
    const a = this.active;
    if (!this.fits(type, 0, a.x, a.y)) {
      if (this.fits(type, 0, a.x, a.y - 1)) a.y -= 1;
      else if (this.fits(type, 0, a.x, a.y - 2)) a.y -= 2;
      else { this.topOut(); return; }
    }
    this.onEvent({ t: 'spawn', type });
  }

  private topOut() {
    this.status = 'over';
    this.onEvent({ t: 'over' });
  }

  pps(): number {
    return this.elapsed > 0 ? this.pieces / this.elapsed : 0;
  }
}