type VolKind = 'master' | 'sfx' | 'music';

class AudioBus {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private timer: number | null = null;
  private nextStep = 0;
  private step = 0;
  private vols: Record<VolKind, number> = { master: 0.9, sfx: 0.8, music: 0.42 };
  muted = false;
  musicOn = true;
  intensity = 0; // 0 normal, 1 fever

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.vols.master;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.vols.sfx;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? this.vols.music : 0;
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 1100;
    this.musicFilter.connect(this.musicBus);
    this.musicBus.connect(this.master);
    this.nextStep = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  applySettings(s: { muted: boolean; musicOn: boolean; volMaster: number; volSfx: number; volMusic: number }) {
    this.muted = s.muted;
    this.musicOn = s.musicOn;
    this.vols = { master: s.volMaster, sfx: s.volSfx, music: s.volMusic };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.volMaster, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(s.volSfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(s.musicOn ? s.volMusic : 0, t, 0.08);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, when = 0, dest?: AudioNode) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest ?? this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, when = 0, type: BiquadFilterType = 'lowpass') {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t0);
  }

  move() { this.tone(210, 0.035, 'square', 0.045); }
  rotate() { this.tone(330, 0.05, 'triangle', 0.09, 500); }
  hold() { this.tone(420, 0.07, 'sine', 0.12, 580); }
  hard() { this.noise(0.09, 0.22, 850); this.tone(95, 0.13, 'sine', 0.3, 48); }
  lock() { this.tone(165, 0.045, 'square', 0.07); }
  click() { this.tone(520, 0.03, 'square', 0.05); }

  clear(n: number, tspin: boolean) {
    this.tone(320 + n * 70, 0.18, 'sawtooth', 0.1, 900 + n * 160);
    [660, 880, 1170].slice(0, n + 1).forEach((f, i) => this.tone(f, 0.09, 'triangle', 0.09, undefined, i * 0.035));
    if (tspin) { this.tone(880, 0.22, 'sine', 0.12, 1400); this.tone(1320, 0.18, 'sine', 0.07, 1760, 0.05); }
  }

  tetris() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.34, 'sawtooth', 0.09, undefined, i * 0.045));
    this.tone(130, 0.3, 'sine', 0.24, 65);
    this.noise(0.25, 0.14, 2600, 0, 'highpass');
  }

  perfect() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.11, undefined, i * 0.06));
  }

  fever() {
    this.tone(180, 0.55, 'sawtooth', 0.14, 1400);
    this.noise(0.5, 0.1, 1800, 0.05, 'highpass');
    [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.25, 'square', 0.06, undefined, 0.3 + i * 0.06));
  }

  garbage() { this.tone(110, 0.16, 'sawtooth', 0.14); this.tone(98, 0.16, 'sawtooth', 0.14, undefined, 0.14); }
  attack() { this.tone(700, 0.08, 'square', 0.07, 1050); }
  levelup() { [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, undefined, i * 0.07)); }
  count() { this.tone(600, 0.09, 'square', 0.11); }
  go() { this.tone(900, 0.2, 'square', 0.13, 1250); }
  over() { [400, 300, 220, 140].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.11, f * 0.8, i * 0.16)); }
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.09, undefined, i * 0.09)); }

  // ---- procedural music: 4-bar synthwave loop in A minor ----
  private schedule() {
    if (!this.ctx) return;
    const spb = 60 / 112 / 4; // 16th
    while (this.nextStep < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextStep);
      this.nextStep += spb;
      this.step = (this.step + 1) % 64;
    }
    const target = this.intensity > 0 ? 3200 : 1100;
    this.musicFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.4);
  }

  private playStep(s: number, t: number) {
    if (!this.ctx || !this.musicOn) return;
    const bar = Math.floor(s / 16);
    const roots = [55, 43.65, 65.41, 49]; // A1 F1 C2 G1
    const chords = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [261.63, 329.63, 392], // C
      [196, 246.94, 293.66], // G
    ];
    const root = roots[bar];
    const chord = chords[bar];
    const beat = s % 16;

    // bass: driving 8ths
    if (beat % 2 === 0) {
      const f = beat % 8 === 6 ? root * 2 : root;
      this.mTone(f, 0.16, 'sawtooth', 0.16, t);
    }
    // pad at bar start
    if (beat === 0) {
      chord.forEach((f) => { this.mTone(f, 1.5, 'sawtooth', 0.028, t); this.mTone(f * 1.005, 1.5, 'sawtooth', 0.028, t); });
    }
    // arp 16ths (denser in fever)
    const arpGate = this.intensity > 0 ? true : beat % 2 === 0;
    if (arpGate) {
      const f = chord[beat % 3] * (this.intensity > 0 && beat % 4 === 2 ? 4 : 2);
      this.mTone(f, 0.09, 'square', 0.03, t);
    }
    // hat
    if (beat % 4 === 2) this.mNoise(0.03, this.intensity > 0 ? 0.05 : 0.028, t);
    // kick
    if (beat === 0 || beat === 8) this.mKick(t);
  }

  private mTone(freq: number, dur: number, type: OscillatorType, vol: number, t0: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.musicFilter);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  private mNoise(dur: number, vol: number, t0: number) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.musicFilter);
    src.start(t0);
  }

  private mKick(t0: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(40, t0 + 0.11);
    g.gain.setValueAtTime(0.22, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    o.connect(g); g.connect(this.musicFilter);
    o.start(t0); o.stop(t0 + 0.2);
  }
}

export const audio = new AudioBus();