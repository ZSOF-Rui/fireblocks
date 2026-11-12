import type { Engine } from './engine';

export type Action = 'left' | 'right' | 'soft' | 'cw' | 'ccw' | 'hard' | 'hold';

export interface KeyMap {
  left: string[]; right: string[]; soft: string[];
  cw: string[]; ccw: string[]; hard: string[]; hold: string[];
}

export const SOLO_KEYS: KeyMap = {
  left: ['ArrowLeft'], right: ['ArrowRight'], soft: ['ArrowDown'],
  cw: ['ArrowUp', 'KeyX'], ccw: ['KeyZ', 'ControlLeft', 'ControlRight'],
  hard: ['Space'], hold: ['KeyC', 'ShiftLeft', 'ShiftRight'],
};

export const P1_KEYS: KeyMap = {
  left: ['KeyA'], right: ['KeyD'], soft: ['KeyS'],
  cw: ['KeyW'], ccw: ['KeyQ'],
  hard: ['Space'], hold: ['KeyE', 'ShiftLeft'],
};

export const P2_KEYS: KeyMap = {
  left: ['ArrowLeft'], right: ['ArrowRight'], soft: ['ArrowDown'],
  cw: ['ArrowUp'], ccw: ['Period', 'Slash'],
  hard: ['Enter'], hold: ['ShiftRight'],
};

export interface Handling { das: number; arr: number }

export class InputController {
  private held = new Set<Action>();
  private dir: -1 | 0 | 1 = 0;
  private lastDir: -1 | 1 = 1;
  private dasT = 0;
  private arrT = 0;
  private dasCharged = false;
  private detachFns: (() => void)[] = [];
  enabled = true;

  constructor(
    public engine: Engine,
    public keys: KeyMap,
    public handling: () => Handling,
  ) {}

  attach(target: Window = window) {
    const down = (e: KeyboardEvent) => {
      if (!this.enabled || e.repeat) return;
      const act = this.actionOf(e.code);
      if (!act) return;
      e.preventDefault();
      this.press(act);
    };
    const up = (e: KeyboardEvent) => {
      const act = this.actionOf(e.code);
      if (!act) return;
      e.preventDefault();
      this.release(act);
    };
    const blur = () => {
      this.held.clear();
      this.dir = 0;
      this.engine.setSoft(false);
    };
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', blur);
    this.detachFns.push(() => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
    });
  }

  detach() {
    this.detachFns.forEach((f) => f());
    this.detachFns = [];
    this.engine.setSoft(false);
  }

  private actionOf(code: string): Action | null {
    for (const act of Object.keys(this.keys) as Action[]) {
      if (this.keys[act].includes(code)) return act;
    }
    return null;
  }

  press(act: Action) {
    if (!this.enabled) return;
    const e = this.engine;
    if (e.status !== 'playing') return;
    switch (act) {
      case 'left':
      case 'right': {
        const d = act === 'left' ? -1 : 1;
        this.held.add(act);
        this.dir = d;
        this.lastDir = d;
        this.dasT = 0;
        this.arrT = 0;
        this.dasCharged = false;
        e.move(d);
        break;
      }
      case 'soft':
        this.held.add(act);
        e.setSoft(true);
        break;
      case 'cw': e.rotate(1); break;
      case 'ccw': e.rotate(-1); break;
      case 'hard': e.hardDrop(); break;
      case 'hold': e.holdSwap(); break;
    }
  }

  release(act: Action) {
    this.held.delete(act);
    if (act === 'soft') this.engine.setSoft(false);
    if (act === 'left' || act === 'right') {
      const l = this.held.has('left'), r = this.held.has('right');
      if (l && r) {
        this.dir = this.lastDir === -1 ? 1 : -1;
      } else if (l) this.dir = -1;
      else if (r) this.dir = 1;
      else this.dir = 0;
      this.dasT = 0;
      this.arrT = 0;
      this.dasCharged = false;
      if (this.dir) this.engine.move(this.dir);
    }
  }

  update(dt: number) {
    if (!this.enabled || this.engine.status !== 'playing' || !this.dir) return;
    const { das, arr } = this.handling();
    const d = this.dir;
    if (!this.dasCharged) {
      this.dasT += dt * 1000;
      if (this.dasT >= das) {
        this.dasCharged = true;
        this.arrT = 0;
        if (arr <= 0) { for (let i = 0; i < 10; i++) this.engine.move(d); }
        else this.engine.move(d);
      }
    } else if (arr <= 0) {
      for (let i = 0; i < 10; i++) this.engine.move(d);
    } else {
      this.arrT += dt * 1000;
      while (this.arrT >= arr) {
        this.arrT -= arr;
        this.engine.move(d);
      }
    }
  }
}