import { COLS, ROWS } from '../game/constants';
import type { Active } from '../game/engine';
import type { BoardView } from '../game/renderer';
import type { PieceType } from '../game/constants';

export interface PeerInfo { name: string; avatar: string; rating: number }

export type RoomMsg =
  | { t: 'join'; me: PeerInfo }
  | { t: 'welcome'; me: PeerInfo; seed: number }
  | { t: 'state'; b: string; a: Active | null; s: number; l: number; h: number; f: boolean; st: string; c: number; p: number }
  | { t: 'attack'; n: number }
  | { t: 'over' }
  | { t: 'rematch'; seed: number }
  | { t: 'rematchOk' }
  | { t: 'ping' }
  | { t: 'bye' };

export function encodeBoard(board: number[][]): string {
  let s = '';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) s += String(board[y][x]);
  return s;
}

export function decodeBoard(s: string): number[][] {
  const b: number[][] = [];
  for (let y = 0; y < ROWS; y++) {
    const row: number[] = [];
    for (let x = 0; x < COLS; x++) row.push(Number(s[y * COLS + x]) || 0);
    b.push(row);
  }
  return b;
}

export class RemoteView implements BoardView {
  board: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  active: Active | null = null;
  score = 0;
  lines = 0;
  heat = 0;
  fever = false;
  status = 'playing';
  combo = -1;
  pending = 0;
  name = '';
  avatar = '👾';
  rating = 1000;

  ghostY() { return this.active?.y ?? 0; }
  pendingTotal() { return this.pending; }
  stackHeight() {
    for (let y = 0; y < ROWS; y++) if (this.board[y].some((v) => v)) return ROWS - y;
    return 0;
  }

  apply(m: Extract<RoomMsg, { t: 'state' }>) {
    this.board = decodeBoard(m.b);
    this.active = m.a;
    this.score = m.s;
    this.lines = m.l;
    this.heat = m.h;
    this.fever = m.f;
    this.status = m.st;
    this.combo = m.c;
    this.pending = m.p;
  }
}

export class RoomClient {
  channel: BroadcastChannel;
  peer: PeerInfo | null = null;
  seed: number | null = null;
  lastSeen = Date.now();
  closed = false;
  onPeer: ((p: PeerInfo, seed: number) => void) | null = null;
  onMsg: ((m: RoomMsg) => void) | null = null;
  onLeave: (() => void) | null = null;
  private joinTimer: number | null = null;
  private pingTimer: number | null = null;

  constructor(public code: string, public isHost: boolean, private me: PeerInfo) {
    this.channel = new BroadcastChannel(`fireblocks-room-${code}`);
    this.channel.onmessage = (ev: MessageEvent<RoomMsg>) => {
      if (this.closed) return;
      const m = ev.data;
      this.lastSeen = Date.now();
      if (m.t === 'join' && this.isHost) {
        this.peer = m.me;
        if (this.seed === null) this.seed = (Math.random() * 0xffffffff) >>> 0;
        this.send({ t: 'welcome', me: this.me, seed: this.seed });
        this.onPeer?.(this.peer, this.seed);
      } else if (m.t === 'welcome' && !this.isHost) {
        this.peer = m.me;
        this.seed = m.seed;
        if (this.joinTimer) { clearInterval(this.joinTimer); this.joinTimer = null; }
        this.onPeer?.(this.peer, this.seed);
      } else if (m.t === 'bye') {
        this.onLeave?.();
      } else {
        this.onMsg?.(m);
      }
    };
    if (!this.isHost) {
      this.send({ t: 'join', me: this.me });
      this.joinTimer = window.setInterval(() => {
        if (!this.peer) this.send({ t: 'join', me: this.me });
      }, 600);
    }
    this.pingTimer = window.setInterval(() => {
      this.send({ t: 'ping' });
      if (this.peer && Date.now() - this.lastSeen > 5000) this.onLeave?.();
    }, 1000);
  }

  send(m: RoomMsg) {
    if (this.closed) return;
    try { this.channel.postMessage(m); } catch { /* ignore */ }
  }

  close() {
    if (this.closed) return;
    this.send({ t: 'bye' });
    this.closed = true;
    if (this.joinTimer) clearInterval(this.joinTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.channel.close();
  }
}

export function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export type { PieceType };