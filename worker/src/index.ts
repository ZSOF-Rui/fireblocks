export interface Env {
  FB_KV: KVNamespace;
}

interface Entry {
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
}

interface PoolPlayer {
  clientId: string;
  name: string;
  avatar: string;
  rating: number;
  wins: number;
  seen: number;
}

const MODES = new Set(['marathon', 'sprint', 'daily', 'vs']);
const PERIODS = new Set(['day', 'week', 'month', 'all']);
const KEY_RE = /^[A-Za-z0-9-]{1,20}$/;
const TTL: Record<string, number | undefined> = { day: 172800, week: 691200, month: 2764800, all: undefined };

const BOT_NAMES: [string, string][] = [
  ['焰尾Fox', '🦊'], ['方块猎人', '🎯'], ['Nova_7', '👾'], ['夜雨声烦', '🌧️'],
  ['T-Spin大师', '🌀'], ['电磁脉冲', '⚡'], ['像素浪人', '🗡️'], ['疾风剑豪Z', '💨'],
  ['速降幽灵', '👻'], ['连击喵', '🐱'], ['黑洞边境', '🕳️'], ['满行强迫症', '🧩'],
  ['键盘冒烟了', '🔥'], ['四行定胜负', '🏆'], ['深夜上分人', '🌙'], ['火山口蹲点', '🌋'],
];
const TITLES = ['方块新星', '消行好手', '连击狂人', 'T旋专家', '战场老兵', '焰块大师', '传奇方块手'];

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function utcKeys(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return { day, week: `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, month, all: 'all' };
}

async function readList(env: Env, key: string): Promise<Entry[]> {
  const raw = await env.FB_KV.get(key);
  if (!raw) return [];
  try { return JSON.parse(raw) as Entry[]; } catch { return []; }
}

function sortEntries(mode: string, list: Entry[]): Entry[] {
  const l = [...list];
  if (mode === 'sprint') l.sort((a, b) => (a.timeMs ?? 1e12) - (b.timeMs ?? 1e12));
  else if (mode === 'vs') l.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  else l.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return l;
}

function better(mode: string, a: Entry, b: Entry): boolean {
  if (mode === 'sprint') return (a.timeMs ?? 1e12) < (b.timeMs ?? 1e12);
  if (mode === 'vs') return true;
  return (a.score ?? 0) > (b.score ?? 0);
}

async function countOnline(env: Env): Promise<number> {
  const res = await env.FB_KV.list({ prefix: 'online:', limit: 1000 });
  return res.keys.length;
}

async function handleVisit(env: Env, clientId: string): Promise<Response> {
  const keys = utcKeys();
  const total = Number((await env.FB_KV.get('stats:total')) ?? '0') + 1;
  await env.FB_KV.put('stats:total', String(total));
  const dayKey = `stats:day:${keys.day}`;
  const today = Number((await env.FB_KV.get(dayKey)) ?? '0') + 1;
  await env.FB_KV.put(dayKey, String(today), { expirationTtl: TTL.day });

  const uniqKey = `stats:uniq:${keys.day}`;
  let uniq: string[] = [];
  try { uniq = JSON.parse((await env.FB_KV.get(uniqKey)) ?? '[]'); } catch { /* ignore */ }
  if (!uniq.includes(clientId)) {
    uniq = [...uniq.slice(-4999), clientId];
    await env.FB_KV.put(uniqKey, JSON.stringify(uniq), { expirationTtl: TTL.day });
  }
  await env.FB_KV.put(`online:${clientId}`, '1', { expirationTtl: 90 });
  return json({ total, today, online: await countOnline(env), unique: uniq.length });
}

async function handleStats(env: Env): Promise<Response> {
  const keys = utcKeys();
  const total = Number((await env.FB_KV.get('stats:total')) ?? '0');
  const today = Number((await env.FB_KV.get(`stats:day:${keys.day}`)) ?? '0');
  let unique = 0;
  try { unique = (JSON.parse((await env.FB_KV.get(`stats:uniq:${keys.day}`)) ?? '[]') as string[]).length; } catch { /* ignore */ }
  return json({ total, today, online: await countOnline(env), unique });
}

async function handleList(env: Env, url: URL): Promise<Response> {
  const mode = url.searchParams.get('mode') ?? '';
  const period = url.searchParams.get('period') ?? 'all';
  const key = url.searchParams.get('key') ?? utcKeys()[period as keyof ReturnType<typeof utcKeys>] ?? 'all';
  if (!MODES.has(mode) || !PERIODS.has(period) || !KEY_RE.test(key)) return json({ error: 'bad params' }, 400);
  const entries = sortEntries(mode, await readList(env, `lb:${mode}:${period}:${key}`)).slice(0, 50);
  return json({ entries });
}

async function handleSubmit(env: Env, body: Record<string, unknown>): Promise<Response> {
  const mode = String(body.mode ?? '');
  const cid = String(body.clientId ?? '').slice(0, 40);
  if (!MODES.has(mode) || !cid) return json({ error: 'bad params' }, 400);

  const name = String(body.name ?? '无名火焰').slice(0, 24);
  const avatar = String(body.avatar ?? '🔥').slice(0, 8);
  const entry: Entry = { id: cid, name, avatar, date: Date.now() };
  if (mode === 'sprint') {
    const t = Number(body.timeMs);
    if (!Number.isFinite(t) || t < 15000 || t > 3600000) return json({ error: 'invalid time' }, 400);
    entry.timeMs = Math.round(t);
    entry.lines = 40;
  } else if (mode === 'vs') {
    entry.rating = Math.max(100, Math.min(4000, Math.round(Number(body.rating) || 1000)));
    entry.wins = Math.max(0, Math.min(100000, Math.round(Number(body.wins) || 0)));
  } else {
    const s = Number(body.score);
    if (!Number.isFinite(s) || s < 0 || s > 1e9) return json({ error: 'invalid score' }, 400);
    entry.score = Math.round(s);
    entry.lines = Math.max(0, Math.min(10000, Math.round(Number(body.lines) || 0)));
    entry.level = Math.max(1, Math.min(30, Math.round(Number(body.level) || 1)));
  }

  // client-provided period keys keep buckets aligned with the player's local timezone
  const clientKeys = (body.keys ?? {}) as Record<string, string>;
  const fallback = utcKeys();
  const periods = mode === 'daily' ? ['day'] : ['day', 'week', 'month', 'all'];
  let result = { rank: 0, total: 0 };

  for (const period of periods) {
    let key = clientKeys[period];
    if (!key || !KEY_RE.test(key)) key = fallback[period as keyof typeof fallback];
    const kvKey = `lb:${mode}:${period}:${key}`;
    const existing = await readList(env, kvKey);
    const prev = existing.find((e) => e.id === cid);
    let list = existing.filter((e) => e.id !== cid);
    const keep = prev && !better(mode, entry, prev) ? { ...prev, name, avatar, date: Date.now() } : entry;
    list.push(keep);
    list = sortEntries(mode, list).slice(0, 100);
    const ttl = TTL[period];
    await env.FB_KV.put(kvKey, JSON.stringify(list), ttl ? { expirationTtl: ttl } : undefined);
    if (period === 'all' || (mode === 'daily' && period === 'day')) {
      result = { rank: list.findIndex((e) => e.id === cid) + 1, total: list.length };
    }
  }

  if (mode === 'vs') {
    let pool: PoolPlayer[] = [];
    try { pool = JSON.parse((await env.FB_KV.get('pool')) ?? '[]'); } catch { /* ignore */ }
    pool = pool.filter((p) => p.clientId !== cid);
    pool.push({ clientId: cid, name, avatar, rating: entry.rating ?? 1000, wins: entry.wins ?? 0, seen: Date.now() });
    pool = pool.slice(-200);
    await env.FB_KV.put('pool', JSON.stringify(pool));
  }
  return json(result);
}

async function handleMatch(env: Env, url: URL): Promise<Response> {
  const rating = Math.max(100, Math.min(4000, Number(url.searchParams.get('rating')) || 1000));
  const cid = url.searchParams.get('client') ?? '';
  let pool: PoolPlayer[] = [];
  try { pool = JSON.parse((await env.FB_KV.get('pool')) ?? '[]'); } catch { /* ignore */ }
  const candidates = pool.filter((p) => p.clientId !== cid && Date.now() - p.seen < 30 * 86400000);
  if (candidates.length) {
    const near = candidates.filter((p) => Math.abs(p.rating - rating) <= 300);
    const src = near.length ? near : candidates;
    const pick = src[Math.floor(Math.random() * src.length)];
    const title = TITLES[Math.min(TITLES.length - 1, Math.floor((pick.rating - 650) / 300))];
    return json({ name: pick.name, avatar: pick.avatar, rating: pick.rating, title: `${title} · 真实玩家` });
  }
  const [name, avatar] = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const r = Math.max(650, Math.round(rating + (Math.random() * 400 - 180)));
  const title = TITLES[Math.min(TITLES.length - 1, Math.floor((r - 650) / 300))];
  return json({ name, avatar, rating: r, title });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    try {
      if (url.pathname === '/' ) {
        return json({ name: 'FireBlocks Cloud', ok: true, endpoints: ['/api/stats', '/api/visit', '/api/leaderboard', '/api/match'] });
      }
      if (url.pathname === '/api/stats' && request.method === 'GET') return handleStats(env);
      if (url.pathname === '/api/visit' && request.method === 'POST') {
        const body = (await request.json()) as { clientId?: string };
        const cid = String(body.clientId ?? '').slice(0, 40);
        if (!cid) return json({ error: 'clientId required' }, 400);
        return handleVisit(env, cid);
      }
      if (url.pathname === '/api/leaderboard') {
        if (request.method === 'GET') return handleList(env, url);
        if (request.method === 'POST') return handleSubmit(env, (await request.json()) as Record<string, unknown>);
      }
      if (url.pathname === '/api/match' && request.method === 'GET') return handleMatch(env, url);
      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: 'internal', detail: String(err) }, 500);
    }
  },
};