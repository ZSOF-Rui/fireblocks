import { useEffect, useRef, useState } from 'react';
import { cloud, getApiBase } from '../services/cloud';
import type { BotOpponent } from '../services/cloud';
import { audio } from '../game/audio';
import { useProfile } from '../store';
import { QueueClient } from '../net/queue';
import { WsRoomClient } from '../net/wsroom';
import type { PeerInfo, RoomTransport } from '../net/room';

const SCAN_NAMES = ['焰尾Fox', 'Nova_7', 'T-Spin大师', '速降幽灵', '连击喵', '像素浪人', '电磁脉冲', '黑洞边境', '疾风剑豪Z', '满行强迫症'];

interface RealMatch {
  peer: PeerInfo;
  client: RoomTransport;
  isHost: boolean;
  seed: number;
}

export default function Matchmaking({ onCancel, onStartNet, onStartAi }: {
  onCancel: () => void;
  onStartNet: (client: RoomTransport, isHost: boolean, seed: number) => void;
  onStartAi: (bot: BotOpponent) => void;
}) {
  const p = useProfile();
  const onlineReady = !!getApiBase();
  const [waited, setWaited] = useState(0);
  const [scan, setScan] = useState(0);
  const [real, setReal] = useState<RealMatch | null>(null);
  const [bot, setBot] = useState<BotOpponent | null>(null);
  const [err, setErr] = useState('');
  const [autoIn, setAutoIn] = useState(3);
  const [attempt, setAttempt] = useState(0);
  const entered = useRef(false);
  const queueRef = useRef<QueueClient | null>(null);
  const realRef = useRef<RealMatch | null>(null);
  const doneRef = useRef(false);

  // 没有云端配置时直接走 AI；有云端则进入真人队列
  useEffect(() => {
    doneRef.current = false;
    entered.current = false;
    realRef.current = null;
    setReal(null);
    setBot(null);
    setErr('');
    setWaited(0);
    setAutoIn(3);
    const t0 = Date.now();
    const tick = window.setInterval(() => setWaited(Math.floor((Date.now() - t0) / 1000)), 500);
    const sweep = window.setInterval(() => setScan((x) => x + 1), 140);

    if (!onlineReady) {
      void cloud.findMatch(p.rating).then((b) => {
        if (!doneRef.current) { setBot(b); audio.levelup(); }
      });
      return () => { clearInterval(tick); clearInterval(sweep); };
    }

    const me: PeerInfo = { name: p.name, avatar: p.avatar, rating: p.rating };
    const q = new QueueClient(me);
    queueRef.current = q;
    q.onState = (s, detail) => {
      if (s === 'queued') setErr('');
      else setErr(detail ?? '匹配服务不可用');
    };
    q.onMatched = (m) => {
      if (doneRef.current) return;
      queueRef.current = null;
      try {
        const client = new WsRoomClient(getApiBase(), m.room, m.role === 'host', me, (msg) => setErr(msg), 'online', m.seed);
        const rm: RealMatch = { peer: m.peer, client, isHost: m.role === 'host', seed: m.seed };
        realRef.current = rm;
        setReal(rm);
        audio.levelup();
      } catch (e) {
        setErr(`对局房间创建失败：${String(e).slice(0, 80)}`);
      }
    };
    return () => {
      clearInterval(tick);
      clearInterval(sweep);
      q.cancel();
      if (queueRef.current === q) queueRef.current = null;
    };
  }, [attempt, onlineReady, p.name, p.avatar, p.rating]);

  useEffect(() => {
    if (!real && !bot) return;
    const iv = window.setInterval(() => setAutoIn((x) => Math.max(0, x - 1)), 1000);
    const go = window.setTimeout(() => enter(), 3000);
    return () => { clearInterval(iv); clearTimeout(go); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, bot]);

  useEffect(() => () => {
    queueRef.current?.cancel();
    if (!entered.current) realRef.current?.client.close();
  }, []);

  const findAi = () => {
    queueRef.current?.cancel();
    queueRef.current = null;
    void cloud.findMatch(p.rating).then((b) => { setBot(b); setErr(''); audio.levelup(); });
  };

  const enter = () => {
    if (entered.current || doneRef.current) return;
    if (real) {
      entered.current = true;
      doneRef.current = true;
      audio.go();
      onStartNet(real.client, real.isHost, real.seed);
    } else if (bot) {
      entered.current = true;
      doneRef.current = true;
      audio.go();
      onStartAi(bot);
    }
  };

  const cancel = () => {
    doneRef.current = true;
    queueRef.current?.cancel();
    queueRef.current = null;
    realRef.current?.client.close();
    realRef.current = null;
    audio.click();
    onCancel();
  };

  const retry = () => { if (!doneRef.current) setAttempt((x) => x + 1); };

  if (real || bot) {
    const opp = real?.peer ?? bot!;
    const tag = real
      ? `真人 · ${real.isHost ? '先手' : '后手'}`
      : bot!.title;
    return (
      <div className="screen match-screen">
        <div className="match-found">
          <h2 className="match-found-title">{real ? '⚡ 真人对手已找到' : '🤖 匹配到训练对手'}</h2>
          <div className="vs-splash">
            <div className="vs-card vs-me">
              <span className="vs-avatar">{p.avatar}</span>
              <b>{p.name}</b>
              <i>积分 {p.rating}</i>
              <small>你</small>
            </div>
            <div className="vs-bolt">VS</div>
            <div className="vs-card vs-opp">
              <span className="vs-avatar">{opp.avatar}</span>
              <b>{opp.name}</b>
              <i>积分 {opp.rating}</i>
              <small>{tag}</small>
            </div>
          </div>
          {err && <p className="match-scan">{err}</p>}
          <div className="cta-row center">
            <button className="btn btn-fire btn-lg" onClick={enter}>进入对战（{Math.max(0, autoIn)}）</button>
            <button className="btn btn-ghost btn-lg" onClick={cancel}>取消</button>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="screen match-screen">
        <div className="match-search">
          <div className="radar">
            <div className="radar-ring r1" />
            <div className="radar-ring r2" />
            <div className="radar-ring r3" />
            <div className="radar-sweep" />
            <div className="radar-center">{p.avatar}</div>
          </div>
          <h2>匹配服务暂不可用</h2>
          <p className="match-scan">{err}</p>
          <div className="cta-row center">
            <button className="btn btn-fire" onClick={retry}>重试匹配</button>
            <button className="btn btn-ghost" onClick={findAi}>与 AI 对战</button>
            <button className="btn btn-ghost" onClick={cancel}>返回</button>
          </div>
        </div>
      </div>
    );
  }

  const slow = waited >= 10;
  return (
    <div className="screen match-screen">
      <div className="match-search">
        <div className="radar">
          <div className="radar-ring r1" />
          <div className="radar-ring r2" />
          <div className="radar-ring r3" />
          <div className="radar-sweep" />
          <div className="radar-center">{p.avatar}</div>
          <span className="radar-blip b1" />
          <span className="radar-blip b2" />
          <span className="radar-blip b3" />
        </div>
        <h2>正在匹配真人对手…</h2>
        <p className="match-scan">扫描中：{SCAN_NAMES[scan % SCAN_NAMES.length]}{Array((scan % 3) + 1).fill('.').join('')}</p>
        <p className="match-meta">积分 {p.rating} · 已等待 {waited}s · 在线 {cloud.onlineCount()} 人</p>
        {slow && <p className="match-meta">当前排队人数较少：可以继续等待，或先和 AI 练手</p>}
        <div className="cta-row center">
          <button className="btn btn-ghost" onClick={cancel}>取消匹配</button>
          {slow && <button className="btn btn-fire" onClick={findAi}>与 AI 对战</button>}
        </div>
      </div>
    </div>
  );
}
