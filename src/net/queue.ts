import { getApiBase } from '../services/cloud';
import type { PeerInfo } from './room';

export interface QueueMatched {
  room: string;
  role: 'host' | 'guest';
  seed: number;
  peer: PeerInfo;
}

export type QueueState = 'queued' | 'lost' | 'error';

// 真人匹配：连上 Worker 的 /queue 长连接，服务端按积分配对后下发房间号与共同种子
export class QueueClient {
  onMatched: ((m: QueueMatched) => void) | null = null;
  onState: ((s: QueueState, detail?: string) => void) | null = null;
  private ws: WebSocket | null = null;
  private closed = false;
  private matched = false;
  private reported = false;
  private ping: number | null = null;

  constructor(private me: PeerInfo) {
    this.connect();
  }

  private connect() {
    const base = getApiBase().trim().replace(/\/+$/, '');
    if (!base) {
      this.fail('当前页面未配置云端服务，无法真人匹配');
      return;
    }
    const qs = new URLSearchParams({
      name: this.me.name,
      avatar: this.me.avatar,
      rating: String(this.me.rating),
    });
    try {
      this.ws = new WebSocket(`${base.replace(/^http/, 'ws')}/queue?${qs}`);
    } catch {
      this.fail('无法连接匹配服务，请检查网络');
      return;
    }
    this.ws.onopen = () => {
      this.onState?.('queued');
      this.ping = window.setInterval(() => this.raw({ t: 'ping' }), 20000);
    };
    this.ws.onmessage = (ev) => {
      let m: { t?: string; room?: string; role?: string; seed?: number; peer?: PeerInfo };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.t === 'queued') this.onState?.('queued');
      else if (m.t === 'matched' && m.room && m.seed !== undefined && m.peer) {
        this.matched = true;
        this.cleanup();
        this.onMatched?.({
          room: m.room,
          role: m.role === 'host' ? 'host' : 'guest',
          seed: m.seed,
          peer: m.peer,
        });
      }
    };
    this.ws.onclose = () => {
      this.cleanup();
      if (!this.closed && !this.matched) this.fail('匹配连接已断开，请重试');
    };
    this.ws.onerror = () => {
      if (!this.matched) this.fail('无法连接匹配服务：请检查网络后重试');
    };
  }

  private fail(msg: string) {
    if (this.reported || this.closed || this.matched) return;
    this.reported = true;
    this.cleanup();
    this.onState?.('error', msg);
  }

  private cleanup() {
    if (this.ping !== null) { clearInterval(this.ping); this.ping = null; }
  }

  private raw(m: { t: string }) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(m)); } catch { /* socket already closed */ }
    }
  }

  cancel() {
    if (this.closed) return;
    this.closed = true;
    this.raw({ t: 'cancel' });
    this.cleanup();
    try { this.ws?.close(); } catch { /* already closed */ }
    this.ws = null;
  }
}
