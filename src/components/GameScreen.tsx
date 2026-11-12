import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine } from '../game/engine';
import type { GameEvent } from '../game/engine';
import { Bot, skillFromRating } from '../game/bot';
import { BoardRenderer, drawMini } from '../game/renderer';
import { InputController, SOLO_KEYS, P1_KEYS, P2_KEYS } from '../game/input';
import type { Action } from '../game/input';
import { audio } from '../game/audio';
import { MODE_NAME, SPRINT_TARGET } from '../game/constants';
import type { Mode } from '../game/constants';
import { randomSeed, todaySeed } from '../game/rng';
import { RemoteView, encodeBoard } from '../net/room';
import type { RoomTransport, RoomMsg, RoomVia } from '../net/room';
import type { BotOpponent } from '../services/cloud';
import { cloud } from '../services/cloud';
import { fmtNum, fmtTime, settingsStore, toastStore, useSettings } from '../store';
import TouchControls from './TouchControls';

export interface GameConfig {
  mode: Mode;
  bot?: BotOpponent;
  room?: { client: RoomTransport; isHost: boolean; via?: RoomVia };
  seed?: number;
}

type Phase = 'countdown' | 'playing' | 'paused' | 'over';

interface SideStats {
  score: number; lines: number; level: number; timeMs: number; pps: number;
  maxCombo: number; tspins: number; tetrises: number; pcs: number; attack: number;
}

interface Result {
  winner: 'p1' | 'p2' | null;
  sprintWin?: boolean;
  ratingDelta?: number;
  rank?: number;
  total?: number;
  submitting?: boolean;
  disconnected?: boolean;
  rematchWaiting?: boolean;
  p1: SideStats;
  p2?: SideStats;
}

function statsOf(e: Engine): SideStats {
  return {
    score: e.score, lines: e.lines, level: e.level, timeMs: Math.round(e.elapsed * 1000),
    pps: e.pps(), maxCombo: e.maxCombo, tspins: e.tspins, tetrises: e.tetrises,
    pcs: e.pcs, attack: e.attackTotal,
  };
}

interface Props {
  config: GameConfig;
  onExit: () => void;
  onRematch: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export default function GameScreen({ config, onExit, onRematch, onOpenSettings, onOpenHelp }: Props) {
  const { mode, bot: botInfo, room } = config;
  const isVersus = mode === 'vs-ai' || mode === 'local2p' || mode === 'net';
  const isNet = mode === 'net';
  const isSolo = mode === 'marathon' || mode === 'sprint' || mode === 'daily';
  const canPause = !isNet;
  const settings = useSettings();

  const [phase, setPhase] = useState<Phase>('countdown');
  const [count, setCount] = useState(3);
  const [, setHudTick] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const phaseRef = useRef<Phase>('countdown');
  const finishedRef = useRef(false);
  const p1Ref = useRef<Engine | null>(null);
  const p2Ref = useRef<Engine | null>(null);
  const remoteRef = useRef<RemoteView | null>(null);
  const r1Ref = useRef<BoardRenderer | null>(null);
  const r2Ref = useRef<BoardRenderer | null>(null);
  const in1Ref = useRef<InputController | null>(null);
  const in2Ref = useRef<InputController | null>(null);
  const botRef = useRef<Bot | null>(null);
  const ev1 = useRef<GameEvent[]>([]);
  const ev2 = useRef<GameEvent[]>([]);
  const netAcc = useRef(0);
  const hudAcc = useRef(0);
  const pendingSeed = useRef<number | null>(null);
  const timeouts = useRef<number[]>([]);

  const canvas1 = useRef<HTMLCanvasElement>(null);
  const canvas2 = useRef<HTMLCanvasElement>(null);
  const hold1 = useRef<HTMLCanvasElement>(null);
  const hold2 = useRef<HTMLCanvasElement>(null);
  const next1 = useRef<(HTMLCanvasElement | null)[]>([]);
  const next2 = useRef<(HTMLCanvasElement | null)[]>([]);

  const touchOn = settings.touch === 'on'
    || (settings.touch === 'auto' && (window.matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch')));

  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const clearTimers = () => { timeouts.current.forEach((t) => clearTimeout(t)); timeouts.current = []; };
  const later = (fn: () => void, ms: number) => { timeouts.current.push(window.setTimeout(fn, ms)); };

  const sendState = useCallback(() => {
    const e = p1Ref.current;
    if (!e || !room) return;
    room.client.send({
      t: 'state', b: encodeBoard(e.board), a: e.active, s: e.score, l: e.lines,
      h: e.heat, f: e.fever, st: e.status, c: e.combo, p: e.pendingTotal(),
    });
  }, [room]);

  const handleOver = useCallback((side: 'p1' | 'p2', disconnected = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const p1 = p1Ref.current!;
    const p2 = p2Ref.current;
    if (in1Ref.current) in1Ref.current.enabled = false;
    if (in2Ref.current) in2Ref.current.enabled = false;
    if (p2 && p2.status === 'playing') p2.status = 'win';
    if (p1.status === 'playing' && side === 'p2') p1.status = 'win';
    audio.intensity = 0;
    setPhaseBoth('over');

    const base: Result = { winner: null, p1: statsOf(p1), p2: p2 ? statsOf(p2) : remoteRef.current ? {
      score: remoteRef.current.score, lines: remoteRef.current.lines, level: 1, timeMs: Math.round(p1.elapsed * 1000),
      pps: 0, maxCombo: 0, tspins: 0, tetrises: 0, pcs: 0, attack: 0,
    } : undefined };

    if (isSolo) {
      audio.over();
      cloud.recordSolo(mode, p1.score, Math.round(p1.elapsed * 1000));
      base.submitting = true;
      setResult(base);
      const data = mode === 'sprint'
        ? { timeMs: Math.round(p1.elapsed * 1000), lines: p1.lines }
        : { score: p1.score, lines: p1.lines, level: p1.level };
      cloud.submit(mode, data).then(({ rank, total }) => {
        setResult((r) => (r ? { ...r, rank, total, submitting: false } : r));
      });
      return;
    }

    const winner: 'p1' | 'p2' = side === 'p1' ? 'p2' : 'p1';
    base.winner = winner;
    base.disconnected = disconnected;
    if (isNet) {
      if (side === 'p1') { sendState(); room?.client.send({ t: 'over' }); }
      if (room?.via === 'online') {
        const oppRating = room.client.peer?.rating ?? remoteRef.current?.rating ?? 1000;
        base.ratingDelta = cloud.applyVsResult(winner === 'p1', oppRating);
      }
      if (winner === 'p1') audio.win(); else audio.over();
    } else if (mode === 'vs-ai' && botInfo) {
      const win = winner === 'p1';
      const delta = cloud.applyVsResult(win, botInfo.rating);
      base.ratingDelta = delta;
      if (win) audio.win(); else audio.over();
    } else {
      audio.win();
    }
    setResult(base);
  }, [isSolo, isNet, mode, botInfo, room, sendState]);

  const handleSprintWin = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const p1 = p1Ref.current!;
    if (in1Ref.current) in1Ref.current.enabled = false;
    audio.intensity = 0;
    audio.win();
    setPhaseBoth('over');
    cloud.recordSolo(mode, p1.score, Math.round(p1.elapsed * 1000));
    const base: Result = { winner: null, sprintWin: true, submitting: true, p1: statsOf(p1) };
    setResult(base);
    cloud.submit('sprint', { timeMs: Math.round(p1.elapsed * 1000), lines: p1.lines }).then(({ rank, total }) => {
      setResult((r) => (r ? { ...r, rank, total, submitting: false } : r));
    });
  }, [mode]);

  const initGame = useCallback((seed?: number | string) => {
    clearTimers();
    finishedRef.current = false;
    pendingSeed.current = null;
    ev1.current = [];
    ev2.current = [];
    setResult(null);
    setConfirmExit(false);
    audio.intensity = 0;

    const seedVal = seed ?? (mode === 'daily' ? todaySeed() : randomSeed());
    const versus = isVersus;
    const st = settingsStore.get();
    const solo = mode === 'marathon' || mode === 'sprint' || mode === 'daily';
    const p1 = new Engine({
      seed: seedVal, mode, versus,
      startLevel: solo ? st.startLevel : 1,
      speedScale: solo ? st.speedScale : 1,
      onEvent: (e) => ev1.current.push(e),
    });
    p1Ref.current = p1;

    in1Ref.current?.detach();
    in2Ref.current?.detach();
    botRef.current = null;
    p2Ref.current = null;

    if (mode === 'vs-ai' && botInfo) {
      const p2 = new Engine({ seed: randomSeed(), mode: 'vs-ai', versus: true, onEvent: (e) => ev2.current.push(e) });
      p2Ref.current = p2;
      botRef.current = new Bot(p2, skillFromRating(botInfo.rating));
      p2.start();
    } else if (mode === 'local2p') {
      const p2 = new Engine({ seed: seedVal, mode: 'local2p', versus: true, onEvent: (e) => ev2.current.push(e) });
      p2Ref.current = p2;
      p2.start();
    } else if (isNet) {
      const rv = new RemoteView();
      if (room?.client.peer) {
        rv.name = room.client.peer.name;
        rv.avatar = room.client.peer.avatar;
        rv.rating = room.client.peer.rating;
      }
      remoteRef.current = rv;
      // 匹配成功后双方各自进房，若 20 秒还没有对手握手则视为对局失败
      if (room?.via === 'online') {
        later(() => {
          if (!room.client.peer && !finishedRef.current) {
            toastStore.push('对手未能进入对局，请重新匹配', '⚠️', 'warn');
            handleOver('p2', true);
          }
        }, 20000);
      }
    }

    const handling = () => ({ das: settingsStore.get().das, arr: settingsStore.get().arr });
    const in1 = new InputController(p1, mode === 'local2p' ? P1_KEYS : SOLO_KEYS, handling);
    in1.enabled = false;
    in1.attach();
    in1Ref.current = in1;
    if (mode === 'local2p' && p2Ref.current) {
      const in2 = new InputController(p2Ref.current, P2_KEYS, handling);
      in2.enabled = false;
      in2.attach();
      in2Ref.current = in2;
    }

    p1.start();
    setPhaseBoth('countdown');
    setCount(3);
    audio.count();
    later(() => { setCount(2); audio.count(); }, 700);
    later(() => { setCount(1); audio.count(); }, 1400);
    later(() => { setCount(0); audio.go(); }, 2100);
    later(() => {
      setPhaseBoth('playing');
      if (in1Ref.current) in1Ref.current.enabled = true;
      if (in2Ref.current) in2Ref.current.enabled = true;
    }, 2550);
  }, [mode, botInfo, isVersus, isNet, room, handleOver]);

  // main loop + renderers + net wiring
  useEffect(() => {
    const opts = () => {
      const s = settingsStore.get();
      return { ghost: s.ghost, grid: s.grid, shake: s.shake, particles: s.particles };
    };
    r1Ref.current = new BoardRenderer(canvas1.current!, () => p1Ref.current!, opts);
    if (isVersus && canvas2.current) {
      r2Ref.current = new BoardRenderer(canvas2.current, () => (isNet ? remoteRef.current! : p2Ref.current!), opts);
    }

    if (isNet && room) {
      room.client.onPeer = (peer) => {
        const rv = remoteRef.current;
        if (!rv) return;
        rv.name = peer.name;
        rv.avatar = peer.avatar;
        rv.rating = peer.rating;
        setHudTick((x) => x + 1);
      };
      room.client.onMsg = (m: RoomMsg) => {
        switch (m.t) {
          case 'state': remoteRef.current?.apply(m); break;
          case 'attack': p1Ref.current?.receiveAttack(m.n); break;
          case 'over': handleOver('p2'); break;
          case 'rematch':
            room.client.send({ t: 'rematchOk' });
            initGame(m.seed);
            break;
          case 'rematchOk':
            if (pendingSeed.current !== null) {
              const s = pendingSeed.current;
              pendingSeed.current = null;
              initGame(s);
            }
            break;
          default: break;
        }
      };
      room.client.onLeave = () => handleOver('p2', true);
    }

    const consume = (queue: GameEvent[], renderer: BoardRenderer | null, side: 'p1' | 'p2') => {
      for (const e of queue) {
        renderer?.onEvent(e);
        switch (e.t) {
          case 'move': audio.move(); break;
          case 'rotate': audio.rotate(); break;
          case 'hard': audio.hard(); break;
          case 'lock': audio.lock(); break;
          case 'hold': audio.hold(); break;
          case 'clear':
            if (e.kind === 'tetris') audio.tetris();
            else audio.clear(e.n ?? 1, (e.kind ?? '').startsWith('ts') || (e.kind ?? '').startsWith('mts'));
            break;
          case 'pc': audio.perfect(); break;
          case 'fever': audio.fever(); audio.intensity = 1; break;
          case 'feverEnd':
            audio.intensity = (p1Ref.current?.fever || p2Ref.current?.fever) ? 1 : 0;
            break;
          case 'garbage': audio.garbage(); break;
          case 'attack': {
            audio.attack();
            if (isNet) room?.client.send({ t: 'attack', n: e.n ?? 0 });
            else if (side === 'p1') p2Ref.current?.receiveAttack(e.n ?? 0);
            else p1Ref.current?.receiveAttack(e.n ?? 0);
            break;
          }
          case 'levelup': audio.levelup(); break;
          case 'over': handleOver(side); break;
          case 'win': handleSprintWin(); break;
          default: break;
        }
      }
      queue.length = 0;
    };

    const drawMinis = () => {
      const p1 = p1Ref.current;
      if (p1) {
        if (hold1.current) drawMini(hold1.current, p1.hold, p1.holdUsed);
        next1.current.forEach((c, i) => { if (c) drawMini(c, p1.queue[i] ?? null); });
      }
      const p2 = p2Ref.current;
      if (p2) {
        if (hold2.current) drawMini(hold2.current, p2.hold, p2.holdUsed);
        next2.current.forEach((c, i) => { if (c) drawMini(c, p2.queue[i] ?? null); });
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (phaseRef.current === 'playing') {
        in1Ref.current?.update(dt);
        in2Ref.current?.update(dt);
        p1Ref.current?.update(dt);
        p2Ref.current?.update(dt);
        botRef.current?.update(dt);
        if (isNet) {
          netAcc.current += dt;
          if (netAcc.current >= 0.15) { netAcc.current = 0; sendState(); }
        }
      }
      consume(ev1.current, r1Ref.current, 'p1');
      consume(ev2.current, r2Ref.current, 'p2');
      r1Ref.current?.draw(dt);
      r2Ref.current?.draw(dt);
      drawMinis();
      hudAcc.current += dt;
      if (hudAcc.current >= 0.12) { hudAcc.current = 0; setHudTick((x) => x + 1); }
    };

    initGame(config.seed);
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden && phaseRef.current === 'playing' && canPause) {
        phaseRef.current = 'paused';
        setPhase('paused');
        if (in1Ref.current) in1Ref.current.enabled = false;
        if (in2Ref.current) in2Ref.current.enabled = false;
      }
    };
    document.addEventListener('visibilitychange', onVis);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__FB = {
        get p1() { return p1Ref.current; },
        get p2() { return p2Ref.current; },
        get remote() { return remoteRef.current; },
        get phase() { return phaseRef.current; },
        restart: () => initGame(),
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimers();
      document.removeEventListener('visibilitychange', onVis);
      in1Ref.current?.detach();
      in2Ref.current?.detach();
      r1Ref.current?.destroy();
      r2Ref.current?.destroy();
      audio.intensity = 0;
      if (room) { room.client.onMsg = null; room.client.onLeave = null; room.client.onPeer = null; }
      if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>).__FB;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = useCallback(() => {
    if (!canPause || finishedRef.current) return;
    if (phaseRef.current === 'playing') {
      setPhaseBoth('paused');
      if (in1Ref.current) in1Ref.current.enabled = false;
      if (in2Ref.current) in2Ref.current.enabled = false;
      audio.click();
    } else if (phaseRef.current === 'paused') {
      setPhaseBoth('playing');
      if (in1Ref.current) in1Ref.current.enabled = true;
      if (in2Ref.current) in2Ref.current.enabled = true;
      audio.click();
    }
  }, [canPause]);

  // global keys: pause / restart / exit
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (confirmExit) { setConfirmExit(false); return; }
        if (canPause) togglePause();
        else if (!finishedRef.current) setConfirmExit(true);
      } else if (e.code === 'KeyR' && isSolo && phaseRef.current !== 'countdown') {
        e.preventDefault();
        initGame();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [confirmExit, canPause, togglePause, isSolo, initGame]);

  // exit request from nav
  useEffect(() => {
    const h = () => {
      if (finishedRef.current || phaseRef.current === 'countdown') onExit();
      else setConfirmExit(true);
    };
    window.addEventListener('fb-exit-request', h);
    return () => window.removeEventListener('fb-exit-request', h);
  }, [onExit]);

  const requestExit = () => {
    if (finishedRef.current || phaseRef.current === 'countdown') onExit();
    else setConfirmExit(true);
  };

  const doRematch = () => {
    if (isNet && room) {
      const seed = randomSeed();
      pendingSeed.current = seed;
      room.client.send({ t: 'rematch', seed });
      setResult((r) => (r ? { ...r, rematchWaiting: true } : r));
      later(() => {
        if (pendingSeed.current !== null) {
          pendingSeed.current = null;
          setResult((r) => (r ? { ...r, rematchWaiting: false } : r));
        }
      }, 6000);
    } else {
      initGame();
    }
  };

  const openSettings = () => { if (phaseRef.current === 'playing' && canPause) togglePause(); onOpenSettings(); };
  const openHelp = () => { if (phaseRef.current === 'playing' && canPause) togglePause(); onOpenHelp(); };

  const p1 = p1Ref.current;
  const p2 = p2Ref.current;
  const remote = remoteRef.current;
  const oppName = mode === 'vs-ai' ? botInfo?.name ?? '对手' : isNet ? remote?.name || '对手' : '玩家 2';
  const oppAvatar = mode === 'vs-ai' ? botInfo?.avatar ?? '👾' : isNet ? remote?.avatar || '👾' : '🎮';
  const oppSub = mode === 'vs-ai' ? `积分 ${botInfo?.rating ?? '?'}` : isNet ? `积分 ${remote?.rating ?? '?'}` : '同一键盘';

  const feverMeter = (e: Engine | RemoteView | null, compact = false) => {
    if (!e) return null;
    const heat = e.heat;
    const fever = e.fever;
    return (
      <div className={`fever-meter ${fever ? 'fever-on' : ''} ${compact ? 'fever-compact' : ''}`}>
        <div className="fever-head"><span>🔥 FEVER</span><b>{fever ? '×2 燃烧中!' : `${Math.floor(heat)}%`}</b></div>
        <div className="fever-track"><div className="fever-fill" style={{ width: `${Math.min(100, heat)}%` }} /></div>
      </div>
    );
  };

  const pendingBar = (e: Engine | RemoteView | null) => {
    const n = e?.pendingTotal() ?? 0;
    if (!n) return null;
    return (
      <div className="pending-bar" title={`来袭垃圾行 ${n}`}>
        <div className="pending-fill" style={{ height: `${Math.min(100, (n / 20) * 100)}%` }} />
        <span className="pending-num">{n}</span>
      </div>
    );
  };

  const statList = (e: Engine | null) => e && (
    <div className="stat-list">
      <div className="stat-row stat-score"><span>分数</span><b>{fmtNum(e.score)}</b></div>
      <div className="stat-row"><span>行数</span><b>{e.lines}{mode === 'sprint' ? ` / ${SPRINT_TARGET}` : ''}</b></div>
      <div className="stat-row"><span>等级</span><b>Lv.{e.level}</b></div>
      <div className="stat-row"><span>时间</span><b>{fmtTime(e.elapsed * 1000)}</b></div>
      <div className="stat-row"><span>PPS</span><b>{e.pps().toFixed(2)}</b></div>
      {isVersus && <div className="stat-row"><span>攻击</span><b>{e.attackTotal}</b></div>}
      {e.combo > 0 && <div className="stat-row stat-combo"><span>连击</span><b>×{e.combo}</b></div>}
      {e.b2b && <div className="stat-row stat-b2b"><span>B2B</span><b>连锁中</b></div>}
    </div>
  );

  const miniRow = (side: 1 | 2, e: Engine | null, n: number) => e && (
    <div className="mini-row">
      <div className="mini-box">
        <small>HOLD</small>
        <canvas ref={side === 1 ? hold1 : hold2} className="mini-canvas" />
      </div>
      <div className="mini-box mini-next">
        <small>NEXT</small>
        <div className="next-strip">
          {Array.from({ length: n }, (_, i) => (
            <canvas
              key={i}
              className="mini-canvas mini-sm"
              ref={(el) => { (side === 1 ? next1 : next2).current[i] = el; }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const resultOverlay = result && (
    <div className="overlay">
      <div className="result-card">
        {isSolo ? (
          <>
            <h2 className={result.sprintWin ? 'result-win' : 'result-lose'}>
              {result.sprintWin ? '🎉 竞速完成!' : '💀 游戏结束'}
            </h2>
            <div className="result-big">
              {mode === 'sprint' ? fmtTime(result.p1.timeMs) : fmtNum(result.p1.score)}
              <small>{mode === 'sprint' ? '40 行用时' : '最终得分'}</small>
            </div>
          </>
        ) : (
          <>
            <h2 className={result.winner === 'p1' ? 'result-win' : 'result-lose'}>
              {result.disconnected ? '🔌 对手已断开 · 判定胜利'
                : mode === 'local2p' ? (result.winner === 'p1' ? '🏆 玩家 1 获胜!' : '🏆 玩家 2 获胜!')
                : result.winner === 'p1' ? '🏆 胜利!' : '💀 惜败…'}
            </h2>
            {result.ratingDelta !== undefined && (
              <div className={`rating-delta ${result.ratingDelta >= 0 ? 'up' : 'down'}`}>
                积分 {result.ratingDelta >= 0 ? '+' : ''}{result.ratingDelta}
              </div>
            )}
            <div className="vs-score-line">
              <span>{fmtNum(result.p1.score)}</span><i>得分对比</i><span>{fmtNum(result.p2?.score ?? 0)}</span>
            </div>
          </>
        )}

        <div className="result-grid">
          <div><b>{result.p1.lines}</b><span>消行</span></div>
          <div><b>Lv.{result.p1.level}</b><span>等级</span></div>
          <div><b>{fmtTime(result.p1.timeMs)}</b><span>用时</span></div>
          <div><b>{result.p1.pps.toFixed(2)}</b><span>PPS</span></div>
          <div><b>{result.p1.maxCombo > 0 ? `×${result.p1.maxCombo}` : '-'}</b><span>最大连击</span></div>
          <div><b>{result.p1.tspins}</b><span>T-Spin</span></div>
          <div><b>{result.p1.tetrises}</b><span>Tetris</span></div>
          <div><b>{result.p1.pcs}</b><span>全消</span></div>
          {isVersus && <div><b>{result.p1.attack}</b><span>总攻击</span></div>}
        </div>

        {isSolo && (
          <div className="result-rank">
            {result.submitting ? <><span className="spinner" /> 正在上传成绩…</>
              : result.rank ? <>🏆 全服第 <b>{result.rank}</b> 名 · 共 {result.total} 条记录</> : null}
          </div>
        )}

        <div className="cta-row center">
          <button className="btn btn-primary btn-lg" onClick={doRematch} disabled={result.rematchWaiting}>
            {result.rematchWaiting ? '等待对方确认…' : isNet ? '↻ 再战一局' : '↻ 再来一局'}
          </button>
          {mode === 'vs-ai' && <button className="btn btn-fire btn-lg" onClick={onRematch}>⚔ 重新匹配</button>}
          <button className="btn btn-ghost btn-lg" onClick={onExit}>主页</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`game-screen ${isVersus ? 'versus' : ''} ${touchOn && mode !== 'local2p' ? 'has-touch' : ''}`}>
      <div className="game-top">
        <span className="mode-badge">
          {mode === 'net'
            ? room?.via === 'lan' ? '局域网对战' : room?.via === 'online' ? '在线对战' : '窗口对战'
            : MODE_NAME[mode]}
          {mode === 'daily' ? ` · ${todaySeed().slice(6)}` : ''}
          {isSolo && (settings.startLevel > 1 || settings.speedScale !== 1) ? ` · Lv${settings.startLevel}起 ${Math.round(settings.speedScale * 100)}%` : ''}
        </span>
        <span className="game-timer">{fmtTime((p1?.elapsed ?? 0) * 1000)}</span>
        <div className="game-top-btns">
          {canPause && phase !== 'over' && (
            <button className="icon-btn" onClick={togglePause} title="暂停 (P/Esc)">{phase === 'paused' ? '▶' : '❚❚'}</button>
          )}
          {isSolo && <button className="icon-btn" onClick={() => initGame()} title="重新开始 (R)">↺</button>}
          <button className="icon-btn" onClick={openSettings} title="设置">⚙</button>
          <button className="icon-btn" onClick={openHelp} title="玩法说明">?</button>
        </div>
      </div>

      <div className="arena">
        {isVersus ? (
          <>
            <div className="player-col">
              <div className="player-plate">
                <span className="plate-avatar">{settings.touch ? '🔥' : '🔥'}</span>
                <span className="plate-meta"><b>你</b><i>{mode === 'local2p' ? '玩家 1 · WASD' : '左侧场地'}</i></span>
                {p1?.fever && <span className="plate-fever">🔥</span>}
              </div>
              <div className="vs-stats">
                <span>分数 <b>{fmtNum(p1?.score ?? 0)}</b></span>
                <span>行 <b>{p1?.lines ?? 0}</b></span>
                <span>攻 <b>{p1?.attackTotal ?? 0}</b></span>
              </div>
              <div className="board-frame vs-board">
                <canvas ref={canvas1} className="board-canvas" />
                {pendingBar(p1)}
              </div>
              {miniRow(1, p1, 3)}
              {feverMeter(p1, true)}
            </div>

            <div className="vs-divider">
              <span className="vs-text">VS</span>
              <span className="vs-clock">{fmtTime((p1?.elapsed ?? 0) * 1000)}</span>
              {(p1?.fever || p2?.fever || remote?.fever) && <span className="vs-fever">🔥 FEVER</span>}
            </div>

            <div className="player-col">
              <div className="player-plate">
                <span className="plate-avatar">{oppAvatar}</span>
                <span className="plate-meta"><b>{oppName}</b><i>{oppSub}</i></span>
                {(p2?.fever || remote?.fever) && <span className="plate-fever">🔥</span>}
              </div>
              <div className="vs-stats">
                <span>分数 <b>{fmtNum(p2?.score ?? remote?.score ?? 0)}</b></span>
                <span>行 <b>{p2?.lines ?? remote?.lines ?? 0}</b></span>
                <span>攻 <b>{p2?.attackTotal ?? 0}</b></span>
              </div>
              <div className="board-frame vs-board">
                <canvas ref={canvas2} className="board-canvas" />
                {pendingBar(isNet ? remote : p2)}
              </div>
              {!isNet ? miniRow(2, p2, 3) : <div className="mini-row remote-note">📡 实时同步中 · 6.7Hz</div>}
              {feverMeter(isNet ? remote : p2, true)}
            </div>
          </>
        ) : (
          <>
            <div className="side-panel">
              <div className="panel-box">
                <small className="panel-title">暂存 HOLD</small>
                <canvas ref={hold1} className="mini-canvas hold-canvas" />
              </div>
              {statList(p1)}
              {feverMeter(p1)}
              {mode === 'sprint' && p1 && (
                <div className="sprint-progress">
                  <small>目标 {SPRINT_TARGET} 行</small>
                  <div className="fever-track"><div className="fever-fill sprint-fill" style={{ width: `${Math.min(100, (p1.lines / SPRINT_TARGET) * 100)}%` }} /></div>
                </div>
              )}
            </div>
            <div className="board-frame solo-board">
              <canvas ref={canvas1} className="board-canvas" />
              {pendingBar(p1)}
            </div>
            <div className="side-panel">
              <div className="panel-box">
                <small className="panel-title">下一个 NEXT</small>
                <div className="next-queue">
                  {Array.from({ length: 5 }, (_, i) => (
                    <canvas key={i} className="mini-canvas" ref={(el) => { next1.current[i] = el; }} />
                  ))}
                </div>
              </div>
              <div className="key-hints">
                <small>← → 移动 · ↓ 软降</small>
                <small>↑/X 顺旋 · Z 逆旋</small>
                <small>空格 硬降 · C 暂存</small>
                <small>P 暂停 · R 重开</small>
              </div>
            </div>
          </>
        )}

        {phase === 'countdown' && (
          <div className="overlay overlay-clear">
            <div key={count} className={`count-num ${count === 0 ? 'count-go' : ''}`}>{count === 0 ? 'GO!' : count}</div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="overlay">
            <div className="pause-card">
              <h2>❚❚ 已暂停</h2>
              <div className="cta-col">
                <button className="btn btn-primary btn-lg" onClick={togglePause}>▶ 继续</button>
                {isSolo && <button className="btn btn-ghost" onClick={() => initGame()}>↺ 重新开始</button>}
                <button className="btn btn-ghost" onClick={openSettings}>⚙ 设置</button>
                <button className="btn btn-ghost" onClick={requestExit}>退出对局</button>
              </div>
            </div>
          </div>
        )}

        {resultOverlay}

        {confirmExit && (
          <div className="overlay">
            <div className="pause-card">
              <h2>退出对局？</h2>
              <p className="setting-hint">当前进度将不会保存{isNet ? '，并断开房间连接' : ''}。</p>
              <div className="cta-col">
                <button className="btn btn-primary" onClick={() => setConfirmExit(false)}>继续对局</button>
                <button className="btn btn-danger" onClick={onExit}>确认退出</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {touchOn && mode !== 'local2p' && (
        <TouchControls
          onPress={(a: Action) => in1Ref.current?.press(a)}
          onRelease={(a: Action) => in1Ref.current?.release(a)}
          onPause={togglePause}
          canPause={canPause && phase !== 'over'}
        />
      )}
      {touchOn && mode === 'local2p' && (
        <p className="touch-note">本地双人需要键盘：P1 用 WASD，P2 用方向键。</p>
      )}
    </div>
  );
}