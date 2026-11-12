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

export default function RoomLobby({ onCancel, onStart, initialCode, autoJoin, initialLan }: {
  onCancel: () => void;
  onStart: (client: RoomTransport, isHost: boolean, via: 'window' | 'lan') => void;
  initialCode?: string;
  autoJoin?: boolean;
  initialLan?: string;
}) {
  const p = useProfile();
  const [transport, setTransport] = useState<'window' | 'lan'>(initialLan ? 'lan' : 'window');
  const [lanAddr, setLanAddr] = useState(initialLan ?? defaultLanAddr());
  const [tab, setTab] = useState<'create' | 'join'>(autoJoin ? 'join' : 'create');
  const [code, setCode] = useState(initialCode ?? '');
  const [created, setCreated] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [hint, setHint] = useState('');
  const clientRef = useRef<RoomTransport | null>(null);
  const startedRef = useRef(false);

  const me: PeerInfo = { name: p.name, avatar: p.avatar, rating: p.rating };

  useEffect(() => () => {
    if (!startedRef.current) clientRef.current?.close();
  }, []);

  const bind = (client: RoomTransport, isHost: boolean) => {
    clientRef.current = client;
    client.onPeer = (peer) => {
      if (startedRef.current) return;
      startedRef.current = true;
      audio.go();
      toastStore.push(`已连接 ${peer.avatar} ${peer.name}`, '🔗', 'success');
      onStart(client, isHost, transport);
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

  const makeClient = (c: string, isHost: boolean): RoomTransport | null => {
    if (transport === 'lan') {
      const addr = lanAddr.trim();
      if (!addr) { toastStore.push('请先填写局域网服务地址', '⚠️', 'warn'); return null; }
      return new WsRoomClient(addr, c, isHost, me, (msg) => setHint(msg));
    }
    return new RoomClient(c, isHost, me);
  };

  const create = () => {
    audio.click();
    const c = makeRoomCode();
    const client = makeClient(c, true);
    if (!client) return;
    bind(client, true);
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

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) { toastStore.push('请输入 4 位房间号', '⚠️', 'warn'); return; }
    audio.click();
    const client = makeClient(c, false);
    if (!client) return;
    bind(client, false);
    setWaiting(true);
    setHint('');
    setTimeout(() => {
      if (clientRef.current === client && !client.peer) {
        setHint(transport === 'lan'
          ? '还没连上：请确认主机已运行 lan-play.bat 并创建了该房间，地址与端口正确。'
          : '还没连上：请确认另一个窗口已创建该房间，且在同一浏览器内。');
      }
    }, 8000);
  };

  useEffect(() => {
    if (autoJoin && initialCode && initialCode.length === 4) {
      const t = setTimeout(() => join(), 300);
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
  const roomLink = created
    ? transport === 'lan'
      ? `${lanHttp}/?room=${created}&lan=${encodeURIComponent(lanAddr.trim())}`
      : `${location.origin}${location.pathname}?room=${created}`
    : '';

  return (
    <div className="screen room-screen">
      <div className="room-panel">
        <h2>
          {transport === 'lan'
            ? <>🌐 局域网对战 <small>WebSocket 跨设备直连</small></>
            : <>🪟 窗口对战 <small>BroadcastChannel 真实直连</small></>}
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
            <button className="btn btn-fire btn-lg" onClick={create}>＋ 创建我的房间</button>
            <p className="setting-hint">
              {transport === 'lan' ? '创建后把邀请链接发给同一局域网内的其他设备。' : '创建后把房间号或链接发给另一个窗口。'}
            </p>
          </div>
        )}

        {!waiting && tab === 'join' && (
          <div className="room-body">
            <input
              className="room-input"
              value={code}
              maxLength={4}
              placeholder="房间号"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') join(); }}
            />
            <button className="btn btn-primary btn-lg" onClick={join}>加入对战</button>
          </div>
        )}

        {waiting && (
          <div className="room-waiting">
            {created && (
              <>
                <div className="room-code">{created}</div>
                <div className="cta-row center">
                  <button className="btn btn-ghost" onClick={async () => {
                    toastStore.push(await copyText(created) ? '房间号已复制' : '复制失败，请手动记录', '📋');
                  }}>复制房间号</button>
                  <button className="btn btn-ghost" onClick={async () => {
                    toastStore.push(await copyText(roomLink) ? '邀请链接已复制' : '复制失败', '🔗');
                  }}>复制邀请链接</button>
                </div>
                {transport === 'lan' && (
                  <p className="setting-hint">
                    其他设备：打开 {lanHttp} → 实时对战 → 局域网 → 输入房间号 {created}。
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