import { useCallback, useEffect, useState } from 'react';
import { cloud, cloudStatus, PERIOD_NAME } from '../services/cloud';
import type { LbEntry, LbMode, LbPeriod } from '../services/cloud';
import { audio } from '../game/audio';
import { fmtNum, fmtTime } from '../store';

const TABS: { key: LbMode; label: string; icon: string }[] = [
  { key: 'marathon', label: '马拉松', icon: '🏃' },
  { key: 'sprint', label: '40 行竞速', icon: '⏱️' },
  { key: 'daily', label: '每日挑战', icon: '📅' },
  { key: 'vs', label: '对战积分', icon: '⚔️' },
];

const PERIODS: LbPeriod[] = ['day', 'week', 'month', 'all'];

function relDate(ts: number): string {
  const d = Date.now() - ts;
  if (d < 3600000) return `${Math.max(1, Math.floor(d / 60000))} 分钟前`;
  if (d < 86400000) return `${Math.floor(d / 3600000)} 小时前`;
  return `${Math.floor(d / 86400000)} 天前`;
}

function mainValue(mode: LbMode, e: LbEntry): string {
  if (mode === 'sprint') return e.timeMs !== undefined ? fmtTime(e.timeMs) : '--';
  if (mode === 'vs') return String(e.rating ?? 0);
  return fmtNum(e.score ?? 0);
}

function subValue(mode: LbMode, e: LbEntry): string {
  if (mode === 'vs') return `${e.wins ?? 0} 胜`;
  if (mode === 'sprint') return '40 行';
  return `${e.lines ?? 0} 行 · Lv.${e.level ?? 1}`;
}

export default function Leaderboard() {
  const [tab, setTab] = useState<LbMode>('marathon');
  const [period, setPeriod] = useState<LbPeriod>('all');
  const [entries, setEntries] = useState<LbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(0);
  const [visits, setVisits] = useState<{ total: number; today: number } | null>(null);

  const effPeriod: LbPeriod = tab === 'daily' ? 'day' : period;

  const load = useCallback(async (mode: LbMode, p: LbPeriod, silent = false) => {
    if (!silent) setLoading(true);
    const list = await cloud.list(mode, p);
    setEntries(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(tab, effPeriod); }, [tab, effPeriod, load]);

  useEffect(() => {
    cloud.getStats().then((s) => { setOnline(s.online); setVisits({ total: s.total, today: s.today }); });
  }, []);

  useEffect(() => {
    const t = setInterval(async () => {
      const s = await cloud.getStats();
      setOnline(s.online);
      setVisits({ total: s.total, today: s.today });
      if (await cloud.refreshLive(tab, effPeriod)) load(tab, effPeriod, true);
    }, 12000);
    return () => clearInterval(t);
  }, [tab, effPeriod, load]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const podiumOrder = [top3[1], top3[0], top3[2]];

  return (
    <div className="screen ranking">
      <div className="ranking-head">
        <h1>🏆 全服排行榜</h1>
        <div className="ranking-meta">
          <span className="online-chip"><span className="live-dot" /> {online} 人在线</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { audio.click(); load(tab, effPeriod); }}>↻ 刷新</button>
        </div>
      </div>

      <div className="seg ranking-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => { audio.click(); setTab(t.key); }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab !== 'daily' && (
        <div className="seg period-tabs">
          {PERIODS.map((p) => (
            <button key={p} className={period === p ? 'active' : ''} onClick={() => { audio.click(); setPeriod(p); }}>
              {PERIOD_NAME[p]}
            </button>
          ))}
        </div>
      )}
      {tab === 'daily' && <p className="setting-hint period-tabs">每日挑战榜单每天 0 点重置，今天的所有成绩都在这里。</p>}

      {loading ? (
        <div className="lb-loading"><span className="spinner" /> 正在同步{PERIOD_NAME[effPeriod]}榜单…</div>
      ) : entries.length === 0 ? (
        <div className="lb-loading">🌱 这个榜单还没有记录，来完成第一场对局吧！</div>
      ) : (
        <>
          <div className="podium">
            {podiumOrder.map((e, i) => e && (
              <div key={e.id} className={`podium-card podium-${i === 1 ? 1 : i === 0 ? 2 : 3} ${e.me ? 'is-me' : ''}`}>
                <span className="podium-medal">{i === 1 ? '🥇' : i === 0 ? '🥈' : '🥉'}</span>
                <span className="podium-avatar">{e.avatar}</span>
                <b className="podium-name">{e.name}{e.me && <i className="me-chip">我</i>}</b>
                <span className="podium-value">{mainValue(tab, e)}</span>
                <small>{subValue(tab, e)}</small>
              </div>
            ))}
          </div>

          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead>
                <tr><th>#</th><th>玩家</th><th>{tab === 'sprint' ? '用时' : tab === 'vs' ? '积分' : '分数'}</th><th>战绩</th><th>更新</th></tr>
              </thead>
              <tbody>
                {rest.map((e, i) => (
                  <tr key={e.id} className={e.me ? 'is-me' : ''}>
                    <td className="lb-rank">{i + 4}</td>
                    <td className="lb-name"><span className="lb-avatar">{e.avatar}</span>{e.name}{e.me && <i className="me-chip">我</i>}</td>
                    <td className="lb-value">{mainValue(tab, e)}</td>
                    <td className="lb-sub">{subValue(tab, e)}</td>
                    <td className="lb-date">{relDate(e.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {visits && (
        <div className="visit-stats">
          <span>👁 累计访问 <b>{fmtNum(visits.total)}</b></span>
          <span>📈 今日访问 <b>{fmtNum(visits.today)}</b></span>
          <span>🕐 榜单周期 <b>{PERIOD_NAME[effPeriod]}</b></span>
        </div>
      )}
      <p className="home-footnote">
        {cloudStatus().mode === 'cloud'
          ? '已连接云端 Worker：以下为全站玩家共享的真实日 / 周 / 月 / 总榜数据，每 12 秒自动同步。对战积分按 Elo 规则结算。'
          : '未配置云端时，榜单保存在本地浏览器并模拟实时刷新；部署 Cloudflare Worker 后（见 README），全站玩家共享同一份日 / 周 / 月 / 总榜。对战积分按 Elo 规则结算。'}
      </p>
    </div>
  );
}