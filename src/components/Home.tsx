import { useEffect, useRef, useState } from 'react';
import { Engine } from '../game/engine';
import { Bot } from '../game/bot';
import { BoardRenderer } from '../game/renderer';
import { randomSeed } from '../game/rng';
import { cloud } from '../services/cloud';
import type { SiteStats } from '../services/cloud';
import { fmtNum, fmtTime, useProfile } from '../store';
import { FlameLogo } from './Nav';
import type { Mode } from '../game/constants';

function VisitStats() {
  const [stats, setStats] = useState<SiteStats | null>(null);
  useEffect(() => {
    cloud.getStats().then(setStats);
    const t = setInterval(() => cloud.getStats().then(setStats), 30000);
    return () => clearInterval(t);
  }, []);
  if (!stats) return null;
  return (
    <div className="visit-stats">
      <span>👁 累计访问 <b>{fmtNum(stats.total)}</b></span>
      <span>📈 今日访问 <b>{fmtNum(stats.today)}</b></span>
      <span>🟢 当前在线 <b>{stats.online}</b></span>
    </div>
  );
}

function AttractBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({ score: 0, lines: 0 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    let engine = new Engine({ seed: randomSeed(), mode: 'marathon' });
    let bot = new Bot(engine, { aps: 7.5, error: 0.06, thinkMs: 100 });
    const renderer = new BoardRenderer(canvas, () => engine, () => ({ ghost: true, grid: true, shake: false, particles: 'low' }));
    engine.start();
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (document.hidden) return;
      if (engine.status === 'over') {
        engine = new Engine({ seed: randomSeed(), mode: 'marathon' });
        bot = new Bot(engine, { aps: 7.5, error: 0.06, thinkMs: 100 });
        engine.start();
      }
      bot.update(dt);
      engine.update(dt);
      renderer.draw(dt);
      acc += dt;
      if (acc > 0.5) { acc = 0; setStats({ score: engine.score, lines: engine.lines }); }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); renderer.destroy(); };
  }, []);

  return (
    <div className="attract-frame">
      <div className="attract-head">
        <span className="live-dot" />
        LIVE · AI 演示对局
        <span className="attract-score">{fmtNum(stats.score)} 分 · {stats.lines} 行</span>
      </div>
      <canvas ref={canvasRef} className="attract-canvas" />
    </div>
  );
}

interface Props {
  onPlay: (mode: Mode) => void;
  onMatch: () => void;
  onRoom: () => void;
  onRanking: () => void;
  onHelp: () => void;
}

const MODES: { mode: Mode | 'match' | 'room'; icon: string; title: string; desc: string; tag: string; hot?: boolean }[] = [
  { mode: 'marathon', icon: '🏃', title: '无尽马拉松', desc: '经典升级玩法，重力越来越快，冲击最高分', tag: '单人' },
  { mode: 'sprint', icon: '⏱️', title: '40 行竞速', desc: '最快消除 40 行，毫秒级计时上榜', tag: '竞速' },
  { mode: 'daily', icon: '📅', title: '每日挑战', desc: '今日全员同一套块序，公平决出最强', tag: '每日' },
  { mode: 'match', icon: '⚔️', title: '在线匹配 PK', desc: '按积分匹配对手，垃圾行互攻，胜负算分', tag: '在线', hot: true },
  { mode: 'local2p', icon: '👥', title: '本地双人', desc: '同一键盘分屏对战，面对面互相伤害', tag: '双人' },
  { mode: 'room', icon: '🪟', title: '窗口对战', desc: '开两个浏览器窗口输房间号，真实联机零服务器', tag: '真联机', hot: true },
];

export default function Home({ onPlay, onMatch, onRoom, onRanking, onHelp }: Props) {
  const p = useProfile();
  return (
    <div className="screen home">
      <section className="home-hero">
        <div className="hero-text">
          <div className="hero-badge">🔥 火焰主题 · 标准规则 · 原创狂热系统</div>
          <h1 className="hero-logo">
            <FlameLogo size={64} />
            <span className="hero-logo-cn">炎块</span>
            <span className="hero-logo-en">FIREBLOCKS</span>
          </h1>
          <p className="hero-tagline">
            燃烧你的方块。SRS 踢墙、T-Spin、B2B 连击一应俱全；
            攒满热量触发 <b>FEVER 狂热</b>，得分翻倍、火力全开。
          </p>
          <div className="cta-row">
            <button className="btn btn-primary btn-lg" onClick={() => onPlay('marathon')}>▶ 开始马拉松</button>
            <button className="btn btn-fire btn-lg" onClick={onMatch}>⚔ 在线匹配</button>
            <button className="btn btn-ghost btn-lg" onClick={onHelp}>玩法说明</button>
          </div>
          <div className="hero-stats">
            <div><b>{fmtNum(p.bestScore)}</b><span>最高分</span></div>
            <div><b>{p.bestSprint !== null ? fmtTime(p.bestSprint) : '--:--'}</b><span>40 行最佳</span></div>
            <div><b>{p.rating}</b><span>对战积分</span></div>
            <div><b>{p.wins}</b><span>胜场</span></div>
          </div>
        </div>
        <AttractBoard />
      </section>

      <section className="mode-section">
        <h2 className="section-title"><span>选择模式</span></h2>
        <div className="mode-grid">
          {MODES.map((m) => (
            <button
              key={m.title}
              className={`mode-card ${m.hot ? 'mode-hot' : ''}`}
              onClick={() => {
                if (m.mode === 'match') onMatch();
                else if (m.mode === 'room') onRoom();
                else onPlay(m.mode as Mode);
              }}
            >
              <span className="mode-icon">{m.icon}</span>
              <span className="mode-body">
                <b>{m.title}{m.hot && <i className="mode-flame">HOT</i>}</b>
                <small>{m.desc}</small>
              </span>
              <span className="mode-tag">{m.tag}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-bottom">
        <button className="rank-teaser" onClick={onRanking}>
          <span className="rank-teaser-icon">🏆</span>
          <span>
            <b>全服排行榜</b>
            <small>马拉松 · 竞速 · 每日挑战 · 对战积分，看看你排第几</small>
          </span>
          <span className="rank-teaser-arrow">→</span>
        </button>
        <VisitStats />
        <p className="home-footnote">
          演示环境：排行榜与匹配对手由本地模拟服务提供（数据保存在浏览器），窗口对战为同浏览器真实直连。
          部署 Cloudflare Worker 云端后，即可拥有全站共享的日 / 周 / 月排行榜与真实访问量统计（见 README）。
        </p>
      </section>
    </div>
  );
}