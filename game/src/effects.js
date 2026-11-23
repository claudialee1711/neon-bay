// Effects for Neon Bay v2: exhaust and dust particles, impact sparks,
// and skid marks left by hard braking and hard turns. Purely visual.
export function createEffects() {
  const particles = [];
  const skids = [];
  return {
    particles,
    skids,
    burst(x, y, kind, n = 6) {
      for (let i = 0; i < n; i += 1) {
        if (particles.length >= 320) return;
        const a = Math.random() * Math.PI * 2;
        const sp = kind === 'spark' ? 160 + Math.random() * 220 : 30 + Math.random() * 70;
        particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: kind === 'spark' ? 0.35 : 0.9, maxLife: kind === 'spark' ? 0.35 : 0.9,
          size: kind === 'spark' ? 3 : 5 + Math.random() * 5, kind,
        });
      }
    },
    skid(x1, y1, x2, y2) {
      if (skids.length >= 500) skids.shift();
      skids.push({ x1, y1, x2, y2, life: 14 });
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
    },
  };
}
