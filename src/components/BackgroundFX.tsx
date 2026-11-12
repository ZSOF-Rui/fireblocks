import { useEffect, useRef } from 'react';

interface Ember { x: number; y: number; vy: number; sway: number; phase: number; size: number; a: number; hue: number }

export default function BackgroundFX() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let embers: Ember[] = [];
    let w = 0, h = 0;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const count = Math.min(90, Math.floor((w * h) / 22000));
      embers = Array.from({ length: count }, () => spawn(true));
    };
    const spawn = (anywhere: boolean): Ember => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      vy: 12 + Math.random() * 34,
      sway: 8 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
      size: 0.7 + Math.random() * 2.1,
      a: 0.15 + Math.random() * 0.5,
      hue: 18 + Math.random() * 32,
    });

    let last = performance.now();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (document.hidden) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.y -= e.vy * dt;
        e.phase += dt * 1.4;
        const x = e.x + Math.sin(e.phase) * e.sway;
        if (e.y < -12) { embers[i] = spawn(false); continue; }
        const tw = 0.65 + 0.35 * Math.sin(e.phase * 2.7);
        ctx.fillStyle = `hsla(${e.hue},100%,${55 + tw * 12}%,${e.a * tw})`;
        ctx.beginPath();
        ctx.arc(x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="bg-stack" aria-hidden>
      <div className="bg-aurora bg-aurora-a" />
      <div className="bg-aurora bg-aurora-b" />
      <div className="bg-aurora bg-aurora-c" />
      <canvas ref={ref} className="bg-embers" />
      <div className="bg-grain" />
      <div className="bg-vignette" />
    </div>
  );
}