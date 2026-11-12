import { profileStore, toastStore } from '../store';
import type { Mode } from '../game/constants';
import { todaySeed } from '../game/rng';

export interface LbEntry {
  id: string;
  name: string;
  avatar: string;
  score?: number;
  timeMs?: number;
  lines?: number;
  level?: number;
  rating?: number;
  wins?: number;
  date: number;
  me?: boolean;
}

export type LbMode = 'marathon' | 'sprint' | 'daily' | 'vs';
export type LbPeriod = 'day' | 'week' | 'month' | 'all';

export interface BotOpponent {
  name: string;
  avatar: string;
  rating: number;
  title: string;
}

export interface SiteStats { total: number; today: number; online: number; unique?: number }

export const PERIOD_NAME: Record<LbPeriod, string> = { day: '今日', week: '本周', month: '本月', all: '总榜' };

// ---------- config ----------
declare global {
  interface Window { FIREBLOCKS_CONFIG?: { apiBase?: string } }
}

export function getApiBase(): string {
  const override = localStorage.getItem('fb_api_base');
  if (override !== null) return override.trim().replace(/\/+$/, '');
  const runtime = window.FIREBLOCKS_CONFIG?.apiBase ?? '';
  const env = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
  return (runtime || env).trim().replace(/\/+$/, '');
}

export function setApiBase(v: string) {
  localStorage.setItem('fb_api_base', v.trim().replace(/\/+$/, ''));
  cloudOffline = false;
}

export function clientId(): string {
  let id = localStorage.getItem('fb_client_id');
  if (!id) {
    id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('fb_client_id', id);
  }
  return id;
}

let cloudOffline = false;
let offlineNotified = false;
let startupPending = true;

function markOffline() {
  cloudOffline = true;
  // 启动检测期间由弹窗统一告知，避免与首屏请求的失败 toast 重复
  if (!offlineNotified && !startupPending) {
    offlineNotified = true;
    toastStore.push('云端不可达，已切换本地自定义榜单', '📴', 'warn');
  }
}

async function api<T>(path: string, init?: RequestInit, timeoutMs = 6000): Promise<T | null> {
  const base = getApiBase();
  if (!base || cloudOffline) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    markOffline();
    return null;
  }
}

export function cloudStatus(): { mode: 'cloud' | 'local'; base: string; offline: boolean } {
  const base = getApiBase();
  return { mode: base && !cloudOffline ? 'cloud' : 'local', base, offline: cloudOffline };
}

// ---------- periods ----------
function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoWeekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function periodKey(p: LbPeriod, d = new Date()): string {
  if (p === 'day') return dateKey(d);
  if (p === 'week') return isoWeekKey(d);
  if (p === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return 'all';
}

function inPeriod(ts: number, p: LbPeriod): boolean {
  if (p === 'all') return true;
  return periodKey(p, new Date(ts)) === periodKey(p);
}

// ---------- local storage helpers ----------
const NAMES: [string, string][] = [
  ['焰尾Fox', '🦊'], ['方块猎人', '🎯'], ['Nova_7', '👾'], ['夜雨声烦', '🌧️'],
  ['T-Spin大师', '🌀'], ['电磁脉冲', '⚡'], ['老K不加班', '🃏'], ['像素浪人', '🗡️'],
  ['疾风剑豪Z', '💨'], ['冰与火之歌', '🐉'], ['Ctrl加C', '⌨️'], ['旋转跳跃', '🤸'],
  ['黄金矿工2077', '⛏️'], ['速降幽灵', '👻'], ['连击喵', '🐱'], ['黑洞边境', '🕳️'],
  ['七宝琉璃', '💎'], ['落地成盒', '📦'], ['满行强迫症', '🧩'], ['俄罗斯老方块', '🧱'],
  ['赤道暖流', '🌊'], ['超新星爆发', '🌟'], ['键盘冒烟了', '🔥'], ['四行定胜负', '🏆'],
  ['幽灵操作手', '🎮'], ['深夜上分人', '🌙'], ['消行如呼吸', '🍃'], ['火山口蹲点', '🌋'],
  ['像素凤凰', '🐦'], ['零延迟传说', '🚀'],
];

const TITLES = ['方块新星', '消行好手', '连击狂人', 'T旋专家', '战场老兵', '焰块大师', '传奇方块手'];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function ri(a: number, b: number) { return Math.floor(rnd(a, b + 1)); }
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function localKey(mode: LbMode, period: LbPeriod): string {
  return `fb_lb2_${mode}_${period}_${periodKey(period)}`;
}

function periodStart(p: LbPeriod): number {
  const d = new Date();
  if (p === 'day') { d.setHours(0, 0, 0, 0); return d.getTime(); }
  if (p === 'week') {
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (p === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }
  return Date.now() - 30 * 86400000;
}

function seedLocal(mode: LbMode, period: LbPeriod): LbEntry[] {
  const now = Date.now();
  const start = periodStart(period);
  const count = period === 'day' ? 10 : period === 'week' ? 16 : period === 'month' ? 22 : 28;
  const pool = [...NAMES].sort(() => Math.random() - 0.5);
  const entries: LbEntry[] = [];
  for (let i = 0; i < count; i++) {
    const [name, avatar] = pool[i % pool.length];
    const date = period === 'all'
      ? now - ri(0, 21) * 86400000 - ri(0, 86400) * 1000
      : Math.max(start, now - ri(0, Math.max(1, Math.floor((now - start) / 1000))) * 1000);
    if (mode === 'marathon' || mode === 'daily') {
      const top = mode === 'daily' ? 95000 : period === 'day' ? 120000 : 260000;
      const score = Math.round(rnd(4000, top) / 100) * 100;
      entries.push({ id: `bot-${i}`, name, avatar, score, lines: ri(15, 160), level: ri(2, 15), date });
    } else if (mode === 'sprint') {
      entries.push({ id: `bot-${i}`, name, avatar, timeMs: Math.round(rnd(42000, 260000) / 10) * 10, lines: 40, date });
    } else {
      entries.push({ id: `bot-vs-${i}`, name, avatar, rating: Math.round(rnd(760, 2560)), wins: ri(8, 420), date });
    }
  }
  return sortEntries(mode, entries);
}

function sortEntries(mode: LbMode, list: LbEntry[]): LbEntry[] {
  const l = [...list];
  if (mode === 'sprint') l.sort((a, b) => (a.timeMs ?? 1e12) - (b.timeMs ?? 1e12));
  else if (mode === 'vs') l.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  else l.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return l;
}

function getLocalBoard(mode: LbMode, period: LbPeriod): LbEntry[] {
  const key = localKey(mode, period);
  let list = load<LbEntry[] | null>(key, null);
  if (!list) { list = seedLocal(mode, period); save(key, list); }
  return list.filter((e) => e.me || inPeriod(e.date, period));
}

function better(mode: LbMode, a: LbEntry, b: LbEntry): boolean {
  if (mode === 'sprint') return (a.timeMs ?? 1e12) < (b.timeMs ?? 1e12);
  if (mode === 'vs') return true;
  return (a.score ?? 0) > (b.score ?? 0);
}

function submitLocal(mode: LbMode, data: { score?: number; timeMs?: number; lines?: number; level?: number }): { rank: number; total: number } {
  const p = profileStore.get();
  const periods: LbPeriod[] = mode === 'daily' ? ['day'] : ['day', 'week', 'month', 'all'];
  let result = { rank: 0, total: 0 };
  for (const period of periods) {
    const key = localKey(mode, period);
    let list = getLocalBoard(mode, period);
    const entry: LbEntry = { id: `me-${period}`, name: p.name, avatar: p.avatar, ...data, date: Date.now(), me: true };
    const mine = list.find((e) => e.me);
    if (mine && !better(mode, entry, mine)) {
      mine.name = p.name;
      mine.avatar = p.avatar;
    } else {
      list = list.filter((e) => !e.me);
      list.push(entry);
    }
    list = sortEntries(mode, list).slice(0, 100);
    save(key, list);
    if (period === 'all' || (mode === 'daily' && period === 'day')) {
      result = { rank: list.findIndex((e) => e.me) + 1, total: list.length };
    }
  }
  return result;
}

// ---------- analytics ----------
interface LocalVisits { total: number; day: string; today: number; uniqDays: string[] }

function clientKeys(): Record<LbPeriod, string> {
  return { day: periodKey('day'), week: periodKey('week'), month: periodKey('month'), all: 'all' };
}

export const cloud = {
  async list(mode: LbMode, period: LbPeriod = 'all'): Promise<LbEntry[]> {
    const remote = await api<{ entries: LbEntry[] }>(`/api/leaderboard?mode=${mode}&period=${period}&key=${periodKey(period)}&client=${clientId()}`);
    if (remote?.entries) {
      return remote.entries.map((e) => ({ ...e, me: e.id === clientId() || e.me }));
    }
    await delay(rnd(200, 520));
    let list = getLocalBoard(mode, period);
    if (mode === 'vs') {
      const p = profileStore.get();
      list = list.filter((e) => !e.me);
      list.push({ id: 'me-vs', name: p.name, avatar: p.avatar, rating: p.rating, wins: p.wins, date: Date.now(), me: true });
      list = sortEntries('vs', list);
    }
    return list.slice(0, 50);
  },

  async submit(mode: LbMode, data: { score?: number; timeMs?: number; lines?: number; level?: number }): Promise<{ rank: number; total: number }> {
    const p = profileStore.get();
    const remote = await api<{ rank: number; total: number }>('/api/leaderboard', {
      method: 'POST',
      body: JSON.stringify({ mode, clientId: clientId(), name: p.name, avatar: p.avatar, keys: clientKeys(), ...data }),
    });
    if (remote && typeof remote.rank === 'number') return remote;
    await delay(rnd(240, 560));
    return submitLocal(mode, data);
  },

  async submitVs(): Promise<void> {
    const p = profileStore.get();
    await api('/api/leaderboard', {
      method: 'POST',
      body: JSON.stringify({ mode: 'vs', clientId: clientId(), name: p.name, avatar: p.avatar, rating: p.rating, wins: p.wins, keys: clientKeys() }),
    });
  },

  async findMatch(rating: number): Promise<BotOpponent> {
    const wait = delay(rnd(1700, 3200));
    const remote = await api<BotOpponent>(`/api/match?rating=${rating}&client=${clientId()}`);
    await wait;
    if (remote?.name) return remote;
    const pool = NAMES.filter(() => Math.random() < 0.5);
    const src = pool.length ? pool : NAMES;
    const [name, avatar] = src[ri(0, src.length - 1)];
    const r = Math.max(650, Math.round(rating + rnd(-180, 220)));
    const title = TITLES[Math.min(TITLES.length - 1, Math.floor((r - 650) / 300))];
    return { name, avatar, rating: r, title };
  },

  async trackVisit(): Promise<SiteStats> {
    const remote = await api<SiteStats>('/api/visit', { method: 'POST', body: JSON.stringify({ clientId: clientId() }) });
    if (remote && typeof remote.total === 'number') return remote;
    const v = load<LocalVisits>('fb_visits_v1', { total: 0, day: '', today: 0, uniqDays: [] });
    const today = dateKey();
    v.total += 1;
    if (v.day !== today) { v.day = today; v.today = 0; }
    v.today += 1;
    if (!v.uniqDays.includes(today)) v.uniqDays = [...v.uniqDays.slice(-60), today];
    save('fb_visits_v1', v);
    return { total: v.total, today: v.today, online: this.onlineCount(), unique: v.uniqDays.length };
  },

  async getStats(): Promise<SiteStats> {
    const remote = await api<SiteStats>('/api/stats');
    if (remote && typeof remote.total === 'number') return remote;
    const v = load<LocalVisits>('fb_visits_v1', { total: 0, day: '', today: 0, uniqDays: [] });
    const today = dateKey();
    return { total: v.total, today: v.day === today ? v.today : 0, online: this.onlineCount(), unique: v.uniqDays.length };
  },

  onlineCount(): number {
    const base = 180 + Math.floor(Math.sin(Date.now() / 60000) * 60);
    return base + ri(-15, 15);
  },

  async ping(base?: string): Promise<boolean> {
    const url = (base ?? getApiBase()).trim().replace(/\/+$/, '');
    if (!url) return false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${url}/api/stats`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return false;
      const data = await res.json();
      return typeof data.total === 'number';
    } catch { return false; }
  },

  // 启动检测失败时由弹窗告知用户，故抑制 markOffline 的重复 toast
  async startupCheck(): Promise<'local' | 'cloud' | 'down'> {
    const base = getApiBase();
    if (!base) {
      startupPending = false;
      return 'local';
    }
    const ok = await this.ping(base);
    startupPending = false;
    if (!ok) {
      cloudOffline = true;
      offlineNotified = true;
    }
    return ok ? 'cloud' : 'down';
  },

  applyVsResult(win: boolean, oppRating: number): number {
    const p = profileStore.get();
    const expected = 1 / (1 + Math.pow(10, (oppRating - p.rating) / 400));
    const delta = Math.round(28 * ((win ? 1 : 0) - expected));
    const rating = Math.max(100, p.rating + delta);
    profileStore.set({
      rating,
      wins: p.wins + (win ? 1 : 0),
      losses: p.losses + (win ? 0 : 1),
      games: p.games + 1,
    });
    void this.submitVs();
    return delta;
  },

  recordSolo(mode: Mode, score: number, timeMs: number) {
    const p = profileStore.get();
    const patch: Partial<typeof p> = { games: p.games + 1 };
    if (mode === 'marathon' || mode === 'daily') patch.bestScore = Math.max(p.bestScore, score);
    if (mode === 'sprint') patch.bestSprint = p.bestSprint === null ? timeMs : Math.min(p.bestSprint, timeMs);
    profileStore.set(patch);
  },

  async refreshLive(mode: LbMode, period: LbPeriod): Promise<boolean> {
    if (getApiBase() && !cloudOffline) return true; // real cloud: just re-fetch
    if (Math.random() < 0.45) {
      const key = localKey(mode, period);
      const list = getLocalBoard(mode, period);
      const bots = list.filter((e) => !e.me);
      if (bots.length) {
        const b = bots[ri(0, bots.length - 1)];
        if (mode === 'sprint') b.timeMs = Math.max(38000, (b.timeMs ?? 120000) - ri(200, 3000));
        else if (mode === 'vs') b.rating = (b.rating ?? 1000) + ri(-12, 18);
        else b.score = (b.score ?? 10000) + ri(500, 9000);
        b.date = Date.now();
        save(key, sortEntries(mode, list));
        toastStore.push(`${b.avatar} ${b.name} 刚刚刷新了战绩`, '📡');
        return true;
      }
    }
    return false;
  },
};

export { todaySeed };