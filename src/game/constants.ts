export const COLS = 10;
export const ROWS = 40;
export const HIDDEN = 20;
export const VISIBLE = 20;

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const PIECES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// cell value on board: 0 empty, 1..7 = I O T S Z J L, 8 = garbage
export const PIECE_INDEX: Record<PieceType, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };
export const GARBAGE = 8;

export const COLORS: Record<number, string> = {
  1: '#00e5ff', // I cyan
  2: '#ffd60a', // O gold
  3: '#e14eff', // T magenta-violet
  4: '#39e75f', // S acid green
  5: '#ff3b5c', // Z flame red
  6: '#3d7bff', // J electric blue
  7: '#ff8a00', // L ember orange
  8: '#6b5d55', // garbage warm ash
};

const BASE: Record<PieceType, { n: number; cells: [number, number][] }> = {
  I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

function rotateCells(cells: [number, number][], n: number, times: number): [number, number][] {
  let c = cells;
  for (let t = 0; t < times; t++) c = c.map(([x, y]) => [n - 1 - y, x] as [number, number]);
  return c;
}

// SHAPES[type][rot] -> cell offsets within bounding box
export const SHAPES: Record<PieceType, [number, number][][]> = {} as never;
for (const p of PIECES) {
  SHAPES[p] = [0, 1, 2, 3].map((r) => rotateCells(BASE[p].cells, BASE[p].n, r));
}
export const BOX: Record<PieceType, number> = { I: 4, O: 2, T: 3, S: 3, Z: 3, J: 3, L: 3 };
export const SPAWN_X: Record<PieceType, number> = { I: 3, O: 4, T: 3, S: 3, Z: 3, J: 3, L: 3 };
export const SPAWN_Y = HIDDEN - 2;

// SRS wall kicks, already converted to screen coordinates (y down).
type KickTable = Record<string, [number, number][]>;
export const KICKS_JLSTZ: KickTable = {
  '01': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '10': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '12': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '21': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '23': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '32': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '30': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '03': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
export const KICKS_I: KickTable = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export const LOCK_DELAY = 0.5;
export const MAX_LOCK_RESETS = 15;

export function gravityInterval(level: number): number {
  const l = Math.min(level, 20);
  const s = Math.pow(0.8 - (l - 1) * 0.007, l - 1);
  return Math.max(0.018, s);
}

export type ClearKind =
  | 'single' | 'double' | 'triple' | 'tetris'
  | 'ts0' | 'ts1' | 'ts2' | 'ts3'
  | 'mts0' | 'mts1' | 'mts2';

export const CLEAR_SCORE: Record<ClearKind, number> = {
  single: 100, double: 300, triple: 500, tetris: 800,
  ts0: 400, ts1: 800, ts2: 1200, ts3: 1600,
  mts0: 100, mts1: 200, mts2: 400,
};

export const CLEAR_ATTACK: Record<ClearKind, number> = {
  single: 0, double: 1, triple: 2, tetris: 4,
  ts0: 0, ts1: 2, ts2: 4, ts3: 6,
  mts0: 0, mts1: 0, mts2: 1,
};

export const CLEAR_LABEL: Record<ClearKind, string> = {
  single: 'SINGLE', double: 'DOUBLE', triple: 'TRIPLE', tetris: 'TETRIS!',
  ts0: 'T-SPIN', ts1: 'T-SPIN SINGLE', ts2: 'T-SPIN DOUBLE', ts3: 'T-SPIN TRIPLE',
  mts0: 'T-SPIN MINI', mts1: 'T-SPIN MINI SINGLE', mts2: 'T-SPIN MINI DOUBLE',
};

// combo -> bonus attack (index = combo count, first clear = 0)
export const COMBO_ATTACK = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 6];
export const PC_SCORE = [0, 800, 1200, 1800, 2000];

export const FEVER_DURATION = 12;
export const FEVER_MAX = 100;

export type Mode = 'marathon' | 'sprint' | 'daily' | 'vs-ai' | 'local2p' | 'net';
export const SPRINT_TARGET = 40;

export const MODE_NAME: Record<Mode, string> = {
  marathon: '无尽马拉松',
  sprint: '40 行竞速',
  daily: '每日挑战',
  'vs-ai': '在线匹配',
  local2p: '本地双人',
  net: '窗口对战',
};