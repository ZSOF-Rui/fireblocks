import { useEffect, useRef, useState } from 'react';
import { RoomClient, makeRoomCode } from '../net/room';
import type { PeerInfo } from '../net/room';
import { audio } from '../game/audio';
import { profileStore, toastStore, useProfile } from '../store';

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

export default function RoomLobby({ onCancel, onStart, initialCode, autoJoin }: {
  onCancel: () => void;
  onStart: (client: RoomClient, isHost: boolean) => void;
  initialCode?: string;
  autoJoin?: boolean;
}) {
  const p = useProfile();
  const [tab, setTab] = useState<'create' | 'join'>(autoJoin ? 'join' : 'create');
  const [code, setCode] = useState(initialCode ?? '');
  const [created, setCreated] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [hint, setHint] = useState('');
  const clientRef = useRef<RoomClient | null>(null);
  const startedRef = useRef(false);

  const me: PeerInfo = { name: p.name, avatar: p.avatar, rating: p.rating };

  useEffect(() => () => {
    if (!startedRef.current) clientRef.current?.close();
  }, []);

  const bind = (client: RoomClient, isHost: boolean) => {
    clientRef.current = client;
    client.onPeer = (peer) => {
      if (startedRef.current) return;
      startedRef.current = true;
      audio.go();
      toastStore.push(`已连接 ${peer.avatar} ${peer.name}`, '🔗', 'success');
      onStart(client, isHost);
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

  const create = () => {
    audio.click();
    const c = makeRoomCode();
    const client = new RoomClient(c, true, me);
    bind(client, true);
    setCreated(c);
    setWaiting(true);
    setHint('');
  };

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) { toastStore.push('请输入 4 位房间号', '⚠️', 'warn'); return; }
    audio.click();
    const client = new RoomClient(c, false, me);
    bind(client, false);
    setWaiting(true);
    setHint('');
    setTimeout(() => {
      if (clientRef.current === client && !client.peer) {
        setHint('还没连上：请确认另一个窗口已创建该房间，且在同一浏览器内。');
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

  const roomLink = created ? `${location.origin}${location.pathname}?room=${created}` : '';

  return (
    <div className="screen room-screen">
      <div className="room-panel">
        <h2>🪟 窗口对战 <small>BroadcastChannel 真实直连</small></h2>
        <p className="room-desc">
          在<b>同一浏览器</b>再开一个窗口 / 标签页打开本游戏，两边输入同一房间号即可真实对战：
          互发垃圾行、同步棋盘、胜负判定，全程无需服务器。
        </p>

        {!waiting && (
          <div className="seg room-tabs">
            <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>创建房间</button>
            <button className={tab === 'join' ? 'active' : ''} onClick={() => setTab('join')}>加入房间</button>
          </div>
        )}

        {!waiting && tab === 'create' && (
          <div className="room-body">
            <button className="btn btn-fire btn-lg" onClick={create}>＋ 创建我的房间</button>
            <p className="setting-hint">创建后把房间号或链接发给另一个窗口。</p>
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