import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { audio } from '../game/audio';
import { cloud, cloudStatus, getApiBase, setApiBase } from '../services/cloud';
import { fmtNum, fmtTime, profileStore, settingsStore, toastStore, useProfile, useSettings } from '../store';
import type { Settings } from '../store';

export function Modal({ title, icon, onClose, children, wide }: {
  title: string; icon?: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fb-modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`fb-modal ${wide ? 'fb-modal-wide' : ''}`} role="dialog" aria-label={title}>
        <div className="fb-modal-head">
          <h2>{icon && <span className="fb-modal-icon">{icon}</span>}{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        <div className="fb-modal-body">{children}</div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="setting-row">
      <span className="setting-label">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="setting-value">{value}{unit}</span>
    </label>
  );
}

function Toggle({ label, value, onChange, hint }: {
  label: string; value: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}{hint && <small>{hint}</small>}</span>
      <button
        className={`switch ${value ? 'on' : ''}`}
        role="switch" aria-checked={value} aria-label={label}
        onClick={() => { audio.click(); onChange(!value); }}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}

const DEFAULTS: Settings = {
  das: 150, arr: 30, ghost: true, grid: true, shake: true, particles: 'med',
  muted: false, musicOn: true, volMaster: 0.9, volSfx: 0.8, volMusic: 0.42, touch: 'auto',
};

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const set = (patch: Partial<Settings>) => settingsStore.set(patch);
  const [apiBase, setApiBaseInput] = useState(getApiBase());
  const [testing, setTesting] = useState(false);
  const [cloudOk, setCloudOk] = useState<boolean | null>(null);
  const status = cloudStatus();
  return (
    <Modal title="设置" icon="⚙️" onClose={onClose}>
      <p className="fb-modal-note">所有设置即时生效，并自动保存在本机。</p>
      <h3 className="setting-group">手感</h3>
      <Slider label="DAS 横移延迟" value={s.das} min={60} max={250} step={5} unit="ms" onChange={(v) => set({ das: v })} />
      <Slider label="ARR 横移重复" value={s.arr} min={0} max={80} step={2} unit="ms" onChange={(v) => set({ arr: v })} />
      <p className="setting-hint">DAS：按住方向键到开始连续移动的延迟；ARR：连续移动间隔，0 = 瞬间贴墙。</p>
      <h3 className="setting-group">画面</h3>
      <Toggle label="幽灵投影" hint="显示落点预览" value={s.ghost} onChange={(v) => set({ ghost: v })} />
      <Toggle label="网格线" value={s.grid} onChange={(v) => set({ grid: v })} />
      <Toggle label="屏幕震动" value={s.shake} onChange={(v) => set({ shake: v })} />
      <div className="setting-row">
        <span className="setting-label">粒子质量</span>
        <div className="seg">
          {(['low', 'med', 'high'] as const).map((q) => (
            <button key={q} className={s.particles === q ? 'active' : ''} onClick={() => set({ particles: q })}>
              {q === 'low' ? '低' : q === 'med' ? '中' : '高'}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="setting-label">触屏按键</span>
        <div className="seg">
          {(['auto', 'on', 'off'] as const).map((q) => (
            <button key={q} className={s.touch === q ? 'active' : ''} onClick={() => set({ touch: q })}>
              {q === 'auto' ? '自动' : q === 'on' ? '常开' : '关闭'}
            </button>
          ))}
        </div>
      </div>
      <h3 className="setting-group">声音</h3>
      <Toggle label="背景音乐" value={s.musicOn} onChange={(v) => set({ musicOn: v })} />
      <Slider label="主音量" value={Math.round(s.volMaster * 100)} min={0} max={100} unit="%" onChange={(v) => set({ volMaster: v / 100 })} />
      <Slider label="音效音量" value={Math.round(s.volSfx * 100)} min={0} max={100} unit="%" onChange={(v) => set({ volSfx: v / 100 })} />
      <Slider label="音乐音量" value={Math.round(s.volMusic * 100)} min={0} max={100} unit="%" onChange={(v) => set({ volMusic: v / 100 })} />
      <h3 className="setting-group">云服务（可选）</h3>
      <p className="setting-hint">
        填入 Cloudflare Worker 地址后，排行榜 / 访问量 / 匹配池切换为全站共享的真云端；留空则使用本地自定义榜单（仅本机记录）。部署方法见项目 README。
      </p>
      <label className="field">
        <span>Worker 地址（https://xxx.workers.dev）</span>
        <input value={apiBase} placeholder="留空 = 本地自定义榜单" onChange={(e) => setApiBaseInput(e.target.value)} />
      </label>
      <div className="setting-row">
        <span className={`cloud-status ${status.mode === 'cloud' ? 'ok' : 'local'}`}>
          {status.mode === 'cloud' ? '🟢 云端模式' : '⚪ 本地自定义榜单'}{status.offline ? '（云端不可达）' : ''}
        </span>
        <div className="seg">
          <button
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              const ok = await cloud.ping(apiBase);
              setCloudOk(ok);
              setTesting(false);
              toastStore.push(ok ? '云端连接成功' : '连接失败，请检查地址与部署状态', ok ? '✅' : '⚠️', ok ? 'success' : 'warn');
            }}
          >{testing ? '测试中…' : '测试连接'}</button>
          <button
            onClick={() => {
              setApiBase(apiBase);
              setCloudOk(null);
              toastStore.push(apiBase.trim() ? '已保存云端地址' : '已切换回本地自定义榜单', '💾', 'success');
            }}
          >保存</button>
        </div>
      </div>
      {cloudOk === false && <p className="setting-hint">提示：需先部署 worker/ 目录（一键脚本 deploy-cloud.bat），并确认地址以 https:// 开头。</p>}
      <div className="fb-modal-actions">
        <button className="btn btn-ghost" onClick={() => { settingsStore.set(DEFAULTS); toastStore.push('已恢复默认设置', '↺'); }}>恢复默认</button>
        <button className="btn btn-primary" onClick={onClose}>完成</button>
      </div>
    </Modal>
  );
}

export function CloudDownModal({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const [testing, setTesting] = useState(false);
  const base = getApiBase();
  return (
    <Modal title="云端 Worker 不可达" icon="📡" onClose={onClose}>
      <p className="fb-modal-note">启动时无法连接已配置的云端地址，排行榜 / 访问量 / 匹配池当前使用本地数据。</p>
      <label className="field">
        <span>当前 Worker 地址</span>
        <input value={base} readOnly />
      </label>
      <p className="setting-hint">可改用本地自定义榜单（仅本机记录），或检查地址与网络后重试云端模式；部署方法见项目 README。</p>
      <div className="fb-modal-actions">
        <button
          className="btn btn-ghost"
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            const ok = await cloud.ping(base);
            setTesting(false);
            if (ok) {
              setApiBase(base);
              toastStore.push('云端连接成功', '✅', 'success');
              onClose();
            } else {
              toastStore.push('仍无法连接，请检查地址与部署状态', '⚠️', 'warn');
            }
          }}
        >{testing ? '检测中…' : '重试连接'}</button>
        <button className="btn btn-ghost" onClick={onOpenSettings}>云端设置</button>
        <button
          className="btn btn-primary"
          onClick={() => {
            setApiBase('');
            toastStore.push('已切换本地自定义榜单', '💾', 'success');
            onClose();
          }}
        >改用本地自定义榜单</button>
      </div>
    </Modal>
  );
}

const AVATARS = ['🔥', '⚡', '🐉', '👾', '🦊', '🐺', '🌋', '💥', '🎯', '🚀', '🐱', '💎'];

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const [name, setName] = useState(p.name);
  const [avatar, setAvatar] = useState(p.avatar);
  const winRate = p.wins + p.losses > 0 ? Math.round((p.wins / (p.wins + p.losses)) * 100) : 0;
  return (
    <Modal title="玩家资料" icon="🪪" onClose={onClose}>
      <div className="avatar-picker">
        {AVATARS.map((a) => (
          <button key={a} className={`avatar-opt ${avatar === a ? 'active' : ''}`} onClick={() => { audio.click(); setAvatar(a); }}>{a}</button>
        ))}
      </div>
      <label className="field">
        <span>昵称（最多 12 字）</span>
        <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="输入你的昵称" />
      </label>
      <div className="profile-stats">
        <div><b>{p.rating}</b><span>对战积分</span></div>
        <div><b>{p.wins} / {p.losses}</b><span>胜 / 负</span></div>
        <div><b>{winRate}%</b><span>胜率</span></div>
        <div><b>{fmtNum(p.bestScore)}</b><span>马拉松最高分</span></div>
        <div><b>{p.bestSprint !== null ? fmtTime(p.bestSprint) : '--'}</b><span>40 行最佳</span></div>
        <div><b>{p.games}</b><span>总场次</span></div>
      </div>
      <div className="fb-modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>取消</button>
        <button
          className="btn btn-primary"
          onClick={() => {
            const n = name.trim() || '无名火焰';
            profileStore.set({ name: n, avatar });
            toastStore.push('资料已保存', '✅', 'success');
            onClose();
          }}
        >保存</button>
      </div>
    </Modal>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="玩法说明" icon="📖" onClose={onClose} wide>
      <div className="help-grid">
        <section>
          <h3>🎮 基本规则</h3>
          <ul>
            <li>标准 10×20 场地，<b>7-bag</b> 随机发块，支持 <b>SRS</b> 旋转与踢墙。</li>
            <li><b>幽灵投影</b>预览落点；<b>暂存</b>每块限用一次；落地后有 0.5 秒锁定延迟，可用移动/旋转重置（最多 15 次）。</li>
            <li>每消 10 行升 1 级，重力逐渐加快。堆到顶部即结束。</li>
          </ul>
        </section>
        <section>
          <h3>⌨️ 单人 / 玩家 1 键位</h3>
          <table className="key-table">
            <tbody>
              <tr><td>← →</td><td>左右移动</td><td>↓</td><td>软降</td></tr>
              <tr><td>↑ / X</td><td>顺时针旋转</td><td>Z / Ctrl</td><td>逆时针旋转</td></tr>
              <tr><td>空格</td><td>硬降</td><td>C / Shift</td><td>暂存</td></tr>
              <tr><td>P / Esc</td><td>暂停</td><td>R</td><td>重新开始</td></tr>
            </tbody>
          </table>
          <h3>⌨️ 本地双人 · 玩家 2</h3>
          <table className="key-table">
            <tbody>
              <tr><td>← → ↓</td><td>移动 / 软降</td><td>↑</td><td>顺时针</td></tr>
              <tr><td>. 或 /</td><td>逆时针</td><td>Enter</td><td>硬降</td></tr>
              <tr><td>右 Shift</td><td>暂存</td><td colSpan={2}>玩家 1 使用 WASD + Q/E + 空格</td></tr>
            </tbody>
          </table>
          <p className="setting-hint">触屏设备会自动显示虚拟按键（可在设置中常开/关闭）。</p>
        </section>
        <section>
          <h3>🧮 计分（×当前等级）</h3>
          <table className="score-table">
            <tbody>
              <tr><td>单行 / 双行</td><td>100 / 300</td><td>三行 / <b>TETRIS</b></td><td>500 / <b>800</b></td></tr>
              <tr><td>T-Spin 单/双/三</td><td>800 / 1200 / 1600</td><td>Mini T-Spin 单/双</td><td>200 / 400</td></tr>
              <tr><td>B2B 连锁</td><td>×1.5</td><td>连击 COMBO</td><td>50 × 连击数</td></tr>
              <tr><td>全消 PERFECT</td><td>800~2000 额外</td><td>软降 / 硬降</td><td>1 / 2 每格</td></tr>
            </tbody>
          </table>
        </section>
        <section>
          <h3>⚔️ 对战攻击表</h3>
          <table className="score-table">
            <tbody>
              <tr><td>双行 / 三行</td><td>1 / 2 行</td><td>TETRIS</td><td><b>4 行</b></td></tr>
              <tr><td>T-Spin 单/双/三</td><td>2 / 4 / 6 行</td><td>B2B</td><td>+1 行</td></tr>
              <tr><td>连击</td><td>最高 +6 行</td><td>全消</td><td><b>+10 行</b></td></tr>
            </tbody>
          </table>
          <ul>
            <li>打出的攻击先<b>抵消</b>自己排队中的垃圾行，剩余部分发给对手。</li>
            <li>垃圾行在下次锁定且未消行时从底部顶入；被顶出场地即判负。</li>
          </ul>
        </section>
        <section className="help-fever">
          <h3>🔥 狂热系统 FEVER（原创）</h3>
          <ul>
            <li>消行、T-Spin、连击都会积攒<b>热量槽</b>；热量随时间缓慢流失。</li>
            <li>攒满 100 进入 <b>FEVER</b>：持续 12 秒，<b>所有得分 ×2、每次攻击 +2 行</b>，全场燃起烈焰特效。</li>
            <li>高手向技巧：保持连击不断，让热量滚雪球，连续触发 FEVER 压制对手。</li>
          </ul>
        </section>
        <section>
          <h3>🕹️ 模式</h3>
          <ul>
            <li><b>无尽马拉松</b>：经典升级玩法，冲击最高分。</li>
            <li><b>40 行竞速</b>：最快消除 40 行，计时上榜。</li>
            <li><b>每日挑战</b>：当天所有人同一套块序，公平比分。</li>
            <li><b>在线匹配</b>：按积分匹配对手（演示环境为本地 AI 模拟），胜负影响积分。</li>
            <li><b>本地双人</b>：同一键盘分屏对战，互相发送垃圾行。</li>
            <li><b>窗口对战</b>：同一浏览器开两个窗口，输入房间号即可<b>真实联机</b>（BroadcastChannel 直连，无需服务器）。</li>
          </ul>
        </section>
      </div>
      <div className="fb-modal-actions">
        <button className="btn btn-primary" onClick={onClose}>开始燃烧</button>
      </div>
    </Modal>
  );
}