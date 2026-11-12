import { useEffect, useRef, useState } from 'react';
import { RoomClient, makeRoomCode } from '../net/room';
import type { PeerInfo, RoomTransport } from '../net/room';
import { WsRoomClient } from '../net/wsroom';
import { audio } from '../game/audio';
import { toastStore, useProfile } from '../store';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}

function defaultLanAddr(): string {
  if (location.protocol.startsWith('http')) {
    return location.port === '8788'
      ? `ws://${location.host}`
      : `ws://${location.hostname}:8788`;
  }
  return '';
}

const CODE_RE = /^[A-Z0-9]{3,8}$/;
const isInvite = (t: string) => /[?&]room=/.test(t) || /^https?:\/\//i.test(t.trim());

export default function RoomLobby({ onCancel, onStart, initialCode, autoJoin, initialLan }: {
  onCancel: () => void;
  onStart: (client: RoomTransport, isHost: boolean, via: 'window' | 'lan') => void;
  initialCode?: string;
  autoJoin?: boolean;
  initialLan?: string;
}) {
  const p = useProfile();
  const [transport, setTransport] = useState<'window' | 'lan'>(
    initialLan || location.port === '8788' ? 'lan' : 'window'
  );
  const [lanAddr, setLanAddr] = useState(initialLan ?? defaultLanAddr());
  const [tab, setTab] = useState<'create' | 'join'>(autoJoin ? 'join' : 'create');
  const [code, setCode] = useState(initialCode ?? '');
  const [customCode, setCustomCode] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [hint, setHint] = useState('');
  const clientRef = useRef<RoomTransport | null>(null);
  const startedRef = useRef(false);

  const me: PeerInfo = { name: p.name, avatar: p.avatar, rating: p.rating };

  useEffect(() => () => {
    if (!startedRef.current) clientRef.current?.close();
  }, []);

  const bind = (client: RoomTransport, isHost: boolean, via: 'window' | 'lan') => {
    clientRef.current = client;
    client.onPeer = (peer) => {
      if (startedRef.current) return;
      startedRef.current = true;
      audio.go();
      toastStore.push(`已连接 ${peer.avatar} ${peer.name}`, '🔗', 'success');
      onStart(client, isHost, via);
    };
    client.onLeave = () => {
      if (!startedRef.current) {
        toastStore.push('对方已离开房间', '⚠️', 'warn');
        setWaiting(false);
        setCreated(null);
        clientRef.current = null;
      }
    };
  };

  const makeClient = (c: string, isHost: boolean, tr: 'window' | 'lan', addr: string): RoomTransport | null => {
    if (tr === 'lan') {
      const a = addr.trim();
      if (!a) { toastStore.push('请先填写局域网服务地址', '⚠️', 'warn'); return null; }
      return new WsRoomClient(a, c, isHost, me, (msg) => {
        setHint(msg);
        toastStore.push(msg, '⚠️', 'warn');
      });
    }
    return new RoomClient(c, isHost, me);
  };

  const create = () => {
    audio.click();
    const custom = customCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (custom && !CODE_RE.test(custom)) { toastStore.push('房间号需为 3–8 位字母或数字', '⚠️', 'warn'); return; }
    const c = custom || makeRoomCode();
    const client = makeClient(c, true, transport, lanAddr);
    if (!client) return;
    bind(client, true, transport);
    setCreated(c);
    setWaiting(true);
    setHint('');
    if (transport === 'lan') {
      setTimeout(() => {
        if (clientRef.current === client && !client.peer) {
          setHint('等待其他设备加入：请确认主机已运行 lan-play.bat，且地址正确。');
        }
      }, 8000);
    }
  };

  const joinWith = (raw: string, tr: 'window' | 'lan', addr: string) => {
    const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!CODE_RE.test(c)) { toastStore.push('请输入 3–8 位房间号，或粘贴邀请链接', '⚠️', 'warn'); return; }
    audio.click();
    const client = makeClient(c, false, tr, addr);
    if (!client) return;
    bind(client, false, tr);
    setCode(c);
    setTransport(tr);
    setWaiting(true);
    setHint('');
    setTimeout(() => {
      if (clientRef.current === client && !client.peer) {
        setHint(tr === 'lan'
          ? '还没连上：请确认主机已运行 lan-play.bat 并创建了该房间，地址与端口正确。'
          : '还没连上：请确认另一个窗口已创建该房间，且在同一浏览器内。');
      }
    }, 8000);
  };

  const join = () => joinWith(code, transport, lanAddr);

  // 粘贴邀请链接：?room=CODE 走同机窗口，?room=CODE&lan=ws://... 走局域网
  const pasteJoin = (text: string) => {
    let room = '';
    let lan: string | undefined;
    try {
      const u = new URL(text.trim(), location.href);
      room = u.searchParams.get('room') ?? '';
      lan = u.searchParams.get('lan') ?? undefined;
    } catch { /* 解析失败按非法输入处理 */ }
    if (!room) { toastStore.push('链接里没有找到房间号', '⚠️', 'warn'); return; }
    if (lan) { setLanAddr(lan); joinWith(room, 'lan', lan); }
    else joinWith(room, 'window', lanAddr);
  };

  useEffect(() => {
    if (autoJoin && initialCode && CODE_RE.test(initialCode.toUpperCase())) {
      const t = setTimeout(() => joinWith(initialCode, transport, initialLan ?? lanAddr), 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => {
    clientRef.current?.close();
    clientRef.current = null;
    onCancel();
  };

  const lanHttp = lanAddr.trim().replace(/^ws/, 'http').replace(/\/+$/, '');
  const origin = location.protocol === 'file:' ? '' : `${location.origin}${location.pathname}`;
  const roomLink = created
    ? transport === 'lan'
      ? `${lanHttp}/?room=${created}&lan=${encodeURIComponent(lanAddr.trim())}`
      : `${origin}?room=${created}`
    : '';

  return (
    <div className="screen room-screen">
      <div className="room-panel">
        <h2>
          {transport === 'lan'
            ? <>🌐 自定义房间 <small>局域网跨设备直连</small></>
            : <>🪟 自定义房间 <small>同机多窗口直连</small></>}
        </h2>
        <p className="room-desc">
          {transport === 'lan' ? (
            <>
              在一台电脑上双击 <b>lan-play.bat</b> 启动局域网服务（自动托管游戏页面），
              同一 Wi-Fi 下的其他设备打开 <b>{lanHttp || 'http://主机IP:8788'}</b>，
              两边输入同一房间号即可跨设备真实对战：互发垃圾行、同步棋盘、胜负判定。
            </>
          ) : (
            <>
              在<b>同一浏览器</b>再开一个窗口 / 标签页打开本游戏，两边输入同一房间号即可真实对战：
              互发垃圾行、同步棋盘、胜负判定，全程无需服务器。
            </>
          )}
        </p>

        {!waiting && (
          <div className="seg room-tabs">
            <button className={transport === 'window' ? 'active' : ''} onClick={() => { audio.click(); setTransport('window'); }}>同机窗口</button>
            <button className={transport === 'lan' ? 'active' : ''} onClick={() => { audio.click(); setTransport('lan'); }}>局域网</button>
          </div>
        )}

        {!waiting && transport === 'lan' && (
          <label className="field room-addr">
            <span>局域网服务地址</span>
            <input
              value={lanAddr}
              placeholder="ws://192.168.x.x:8788"
              onChange={(e) => setLanAddr(e.target.value)}
            />
          </label>
        )}

        {!waiting && (
          <div className="seg room-tabs">
            <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>创建房间</button>
            <button className={tab === 'join' ? 'active' : ''} onClick={() => setTab('join')}>加入房间</button>
          </div>
        )}

        {!waiting && tab === 'create' && (
          <div className="room-body">
            <label className="field room-addr">
              <span>自定义房间号（可选 · 3–8 位字母数字）</span>
              <input
                value={customCode}
                maxLength={8}
                placeholder="留空自动生成，如 FIRE88"
                onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              />
            </label>
            <button className="btn btn-fire btn-lg" onClick={create}>＋ 创建房间</button>
            <p className="setting-hint">
              {transport === 'lan' ? '创建后把邀请链接或房间号发给同一局域网内的其他设备。' : '创建后把房间号或邀请链接发给另一个窗口。'}
            </p>
          </div>
        )}

        {!waiting && tab === 'join' && (
          <div className="room-body">
            <input
              className="room-input"
              value={code}
              maxLength={8}
              placeholder="房间号"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') join(); }}
              onPaste={(e) => {
                const txt = e.clipboardData.getData('text');
                if (isInvite(txt)) { e.preventDefault(); pasteJoin(txt); }
              }}
            />
            <button className="btn btn-primary btn-lg" onClick={join}>加入对战</button>
            <p className="setting-hint">输入房间号，或直接粘贴别人分享的邀请链接自动加入。</p>
          </div>
        )}

        {waiting && (
          <div className="room-waiting">
            {created && (
              <>
                <div className={`room-code ${created.length > 4 ? 'room-code-sm' : ''}`}>{created}</div>
                <div className="cta-row center">
                  <button className="btn btn-ghost" onClick={async () => {
                    toastStore.push(await copyText(created) ? '房间号已复制' : '复制失败，请手动记录', '📋');
                  }}>复制房间号</button>
                  <button className="btn btn-ghost" onClick={async () => {
                    toastStore.push(await copyText(roomLink) ? '邀请链接已复制' : '复制失败', '🔗');
                  }}>复制邀请链接</button>
                </div>
                <p className="setting-hint" style={{ textAlign: 'center', margin: 0 }}>
                  邀请链接（对方打开即自动加入，或粘贴到「加入房间」）
                </p>
                <input
                  className="room-link"
                  readOnly
                  value={roomLink}
                  onFocus={(e) => e.currentTarget.select()}
                />
                {location.protocol === 'file:' && transport === 'window' && (
                  <p className="room-hint">离线单文件模式无法用链接跨窗口加入，请用静态服务或局域网模式。</p>
                )}
                {transport === 'lan' && (
                  <p className="setting-hint">
                    其他设备：打开 {lanHttp} → 自定义房间 → 局域网 → 输入房间号 {created}。
                  </p>
                )}
              </>
            )}
            {!created && <div className="room-code">加入 {code.toUpperCase()}</div>}
            <div className="waiting-line"><span className="spinner" /> 等待对手接入…</div>
            {hint && <p className="room-hint">{hint}</p>}
            <button className="btn btn-ghost" onClick={() => { clientRef.current?.close(); clientRef.current = null; setWaiting(false); setCreated(null); }}>取消</button>
          </div>
        )}

        <div className="fb-modal-actions">
          <button className="btn btn-ghost" onClick={leave}>返回主页</button>
        </div>
      </div>
    </div>
  );
}