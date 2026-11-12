import type { PeerInfo, RoomMsg, RoomTransport } from './room';

export class WsRoomClient implements RoomTransport {
  peer: PeerInfo | null = null;
  seed: number | null = null;
  onPeer: ((p: PeerInfo, seed: number) => void) | null = null;
  onMsg: ((m: RoomMsg) => void) | null = null;
  onLeave: (() => void) | null = null;
  onError: ((msg: string) => void) | null = null;
  private ws: WebSocket;
  private closed = false;
  private failed = false;
  private lastSeen = Date.now();
  private pingTimer: number;
  private joinTimer: number | null = null;

  constructor(
    public url: string,
    public code: string,
    public isHost: boolean,
    private me: PeerInfo,
    onError?: (msg: string) => void,
    private kind: 'lan' | 'online' = 'lan',
  ) {
    this.onError = onError ?? null;
    const base = url.trim().replace(/\/+$/, '').replace(/^http/, 'ws');
    this.ws = new WebSocket(`${base}/room?code=${encodeURIComponent(code)}&role=${isHost ? 'host' : 'guest'}`);
    this.ws.onopen = () => { if (!this.isHost) this.raw({ t: 'join', me: this.me }); };
    this.ws.onmessage = (ev) => {
      if (this.closed) return;
      let m: RoomMsg | { t: 'err'; msg?: string };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      this.lastSeen = Date.now();
      if (m.t === 'err') {
        this.fail(m.msg ?? '连接失败');
        return;
      }
      if (m.t === 'join' && this.isHost) {
        this.peer = m.me;
        if (this.seed === null) this.seed = (Math.random() * 0xffffffff) >>> 0;
        this.raw({ t: 'welcome', me: this.me, seed: this.seed });
        this.onPeer?.(this.peer, this.seed);
      } else if (m.t === 'welcome' && !this.isHost) {
        this.peer = m.me;
        this.seed = m.seed;
        if (this.joinTimer !== null) { clearInterval(this.joinTimer); this.joinTimer = null; }
        this.onPeer?.(this.peer, this.seed);
      } else if (m.t === 'bye') {
        this.onLeave?.();
      } else {
        this.onMsg?.(m);
      }
    };
    this.ws.onclose = () => {
      if (this.closed) return;
      if (this.peer) this.onLeave?.();
      else this.fail(this.connectError());
    };
    this.ws.onerror = () => { if (!this.peer) this.fail(this.connectError()); };
    if (!this.isHost) {
      // 主机可能晚于访客进入房间，重发 join 直到握手完成
      this.joinTimer = window.setInterval(() => { if (!this.peer) this.raw({ t: 'join', me: this.me }); }, 1500);
    }
    this.pingTimer = window.setInterval(() => {
      this.raw({ t: 'ping' });
      if (this.peer && Date.now() - this.lastSeen > 5000) this.onLeave?.();
    }, 1000);
  }

  private connectError(): string {
    return this.kind === 'online'
      ? '无法连接在线房间服务：请检查网络后重试'
      : '无法连接局域网服务：请确认主机已运行 lan-play.bat，地址与端口正确';
  }

  private fail(msg: string) {
    if (this.failed || this.closed) return;
    this.failed = true;
    this.onError?.(msg);
    this.onLeave?.();
  }

  private raw(m: RoomMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  send(m: RoomMsg) { if (!this.closed) this.raw(m); }

  close() {
    if (this.closed) return;
    this.raw({ t: 'bye' });
    this.closed = true;
    if (this.joinTimer !== null) clearInterval(this.joinTimer);
    clearInterval(this.pingTimer);
    this.ws.close();
  }
}
