import { useSyncExternalStore } from 'react';
import type { ThemeId } from './game/constants';

function createStore<T extends object>(key: string, initial: T) {
  let state: T = { ...initial };
  try {
    const raw = localStorage.getItem(key);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  const listeners = new Set<() => void>();
  const persist = () => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* ignore */ }
  };
  return {
    get: () => state,
    set(patch: Partial<T>) {
      state = { ...state, ...patch };
      persist();
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

export interface Settings {
  das: number;
  arr: number;
  ghost: boolean;
  grid: boolean;
  shake: boolean;
  particles: 'low' | 'med' | 'high';
  muted: boolean;
  musicOn: boolean;
  volMaster: number;
  volSfx: number;
  volMusic: number;
  touch: 'auto' | 'on' | 'off';
  startLevel: number;
  speedScale: number;
  theme: ThemeId;
}

export const settingsStore = createStore<Settings>('fb_settings_v1', {
  das: 150, arr: 30, ghost: true, grid: true, shake: true, particles: 'med',
  muted: false, musicOn: true, volMaster: 0.9, volSfx: 0.8, volMusic: 0.42, touch: 'auto',
  startLevel: 1, speedScale: 1, theme: 'flame',
});

export interface Profile {
  name: string;
  avatar: string;
  rating: number;
  wins: number;
  losses: number;
  bestScore: number;
  bestSprint: number | null;
  games: number;
}

export const profileStore = createStore<Profile>('fb_profile_v1', {
  name: '无名火焰', avatar: '🔥', rating: 1000, wins: 0, losses: 0,
  bestScore: 0, bestSprint: null, games: 0,
});

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
}

export function useProfile(): Profile {
  return useSyncExternalStore(profileStore.subscribe, profileStore.get);
}

// ---- toasts ----
export interface Toast { id: number; text: string; icon?: string; kind?: 'info' | 'success' | 'warn' }
let toastId = 0;
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();

export const toastStore = {
  get: () => toasts,
  subscribe(l: () => void) { toastListeners.add(l); return () => { toastListeners.delete(l); }; },
  push(text: string, icon?: string, kind: Toast['kind'] = 'info') {
    const id = ++toastId;
    toasts = [...toasts, { id, text, icon, kind }].slice(-4);
    toastListeners.forEach((l) => l());
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      toastListeners.forEach((l) => l());
    }, 3200);
  },
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(toastStore.subscribe, toastStore.get);
}

export function fmtTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const d = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

export function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}