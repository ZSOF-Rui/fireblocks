import { useEffect, useRef, useState } from 'react';
import { cloud } from '../services/cloud';
import type { BotOpponent } from '../services/cloud';
import { audio } from '../game/audio';
import { useProfile } from '../store';

const SCAN_NAMES = ['焰尾Fox', 'Nova_7', 'T-Spin大师', '速降幽灵', '连击喵', '像素浪人', '电磁脉冲', '黑洞边境', '疾风剑豪Z', '满行强迫症'];

export default function Matchmaking({ onCancel, onFound }: {
  onCancel: () => void;
  onFound: (bot: BotOpponent) => void;
}) {
  const p = useProfile();
  const [found, setFound] = useState<BotOpponent | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [scan, setScan] = useState(0);
  const [autoIn, setAutoIn] = useState(3);
  const started = useRef(false);

  useEffect(() => {
    const t0 = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    const s = setInterval(() => setScan((x) => x + 1), 140);
    cloud.findMatch(p.rating).then((bot) => {
      setFound(bot);
      audio.levelup();
    });
    return () => { clearInterval(t); clearInterval(s); };
  }, [p.rating]);

  useEffect(() => {
    if (!found) return;
    const t = setInterval(() => setAutoIn((x) => x - 1), 1000);
    const go = setTimeout(() => { if (!started.current) { started.current = true; onFound(found); } }, 3000);
    return () => { clearInterval(t); clearTimeout(go); };
  }, [found, onFound]);

  const enter = () => {
    if (found && !started.current) { started.current = true; audio.go(); onFound(found); }
  };

  return (
    <div className="screen match-screen">
      {!found ? (
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
          <h2>正在匹配对手…</h2>
          <p className="match-scan">扫描中：{SCAN_NAMES[scan % SCAN_NAMES.length]}{Array((scan % 3) + 1).fill('.').join('')}</p>
          <p className="match-meta">积分 {p.rating} · 已等待 {elapsed}s · 在线 {cloud.onlineCount()} 人</p>
          <button className="btn btn-ghost" onClick={onCancel}>取消匹配</button>
        </div>
      ) : (
        <div className="match-found">
          <h2 className="match-found-title">⚡ 对手已找到</h2>
          <div className="vs-splash">
            <div className="vs-card vs-me">
              <span className="vs-avatar">{p.avatar}</span>
              <b>{p.name}</b>
              <i>积分 {p.rating}</i>
              <small>你</small>
            </div>
            <div className="vs-bolt">VS</div>
            <div className="vs-card vs-opp">
              <span className="vs-avatar">{found.avatar}</span>
              <b>{found.name}</b>
              <i>积分 {found.rating}</i>
              <small>{found.title}</small>
            </div>
          </div>
          <div className="cta-row center">
            <button className="btn btn-fire btn-lg" onClick={enter}>进入对战（{Math.max(0, autoIn)}）</button>
            <button className="btn btn-ghost btn-lg" onClick={onCancel}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}